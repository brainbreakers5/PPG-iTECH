const ZKLib = require('zkteco-js');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

/**
 * BIOMETRIC REAL-TIME BRIDGE
 * 
 * This script connects to your device (172.16.107.81) and pushes data
 * to the web application as soon as someone punches their finger.
 */

const DEVICE_IP = process.env.BIOMETRIC_DEVICE_IP || '172.16.107.81';
const DEVICE_PORT = Number(process.env.BIOMETRIC_DEVICE_PORT || 4370);
const DEVICE_ID = process.env.BIOMETRIC_DEVICE_ID || 'MAIN_DEVICE_01';
const POLL_INTERVAL_MS = Number(process.env.BIOMETRIC_POLL_INTERVAL_MS || 300000); // 5 minutes
const POLL_PUSH_DELAY_MS = Number(process.env.BIOMETRIC_POLL_PUSH_DELAY_MS || 25);
const SERVER_API_URL = process.env.SERVER_API_BIOMETRIC_URL || `http://localhost:${process.env.PORT || 5000}/api/biometric/log`; // Adjust if server is remote

const makeAxiosOptions = () => {
  const axiosOptions = {};
  if (process.env.DISABLE_TLS_VERIFY === '1') {
    axiosOptions.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }
  return axiosOptions;
};

const safeParseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizePunchType = (rawType, dateRef) => {
  const val = String(rawType ?? '').trim().toUpperCase();
  if (val === 'IN' || val === '0') return 'IN';
  if (val === 'OUT' || val === '1') return 'OUT';
  const dt = safeParseDate(dateRef) || new Date();
  return dt.getHours() < 12 ? 'IN' : 'OUT';
};

// Lightweight local de-dupe to prevent realtime + polling from re-sending the same record repeatedly.
// Server also has DB-level conflict guard + near-duplicate debouncer.
const RECENT_SEEN_MAX = Number(process.env.BIOMETRIC_RECENT_SEEN_MAX || 5000);
const seenKeys = new Set();
const seenQueue = [];
const rememberSeen = (key) => {
  if (!key) return;
  if (seenKeys.has(key)) return;
  seenKeys.add(key);
  seenQueue.push(key);
  while (seenQueue.length > RECENT_SEEN_MAX) {
    const old = seenQueue.shift();
    if (old) seenKeys.delete(old);
  }
};

const buildPunchKey = (empId, timestampIso) => `${String(empId || '').trim()}|${String(timestampIso || '').trim()}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

const getDateRangeForTodayAndYesterday = () => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  return { startOfYesterday, startOfTomorrow };
};

const isDeviceConnectionError = (err) => {
  const details = unwrapError(err);
  const code = String(details?.code || '').toUpperCase();
  const msg = String(details?.message || '').toLowerCase();
  return (
    ['ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET'].includes(code) ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('socket') ||
    msg.includes('connect')
  );
};

const unwrapError = (err) => {
  // zkteco-js sometimes wraps real Error inside nested "Errors" objects.
  const candidates = [
    err,
    err?.err,
    err?.err?.err,
    err?.error,
    err?.cause,
    err?.cause?.err,
  ].filter(Boolean);

  const core = candidates.find((c) => c instanceof Error) || candidates.find((c) => typeof c?.message === 'string' || typeof c?.code === 'string') || err;

  return {
    message: core?.message,
    code: core?.code,
    errno: core?.errno,
    syscall: core?.syscall,
    address: core?.address,
    port: core?.port,
    stack: core?.stack,
  };
};

const pushToServer = async ({ userId, timestamp, recordTime, type, deviceId, raw }) => {
  const empId = String(userId || '').trim();
  if (!empId) return;

  const dt = safeParseDate(timestamp || recordTime);
  const iso = (dt || new Date()).toISOString();
  const key = buildPunchKey(empId, iso);
  if (seenKeys.has(key)) return;
  rememberSeen(key);

  try {
    const payload = {
      emp_id: empId,
      device_id: deviceId || DEVICE_ID,
      timestamp: iso,
      type: normalizePunchType(type, dt),
      // Keep raw for debugging/backtracking if needed; server ignores unknown fields.
      raw
    };

    const response = await axios.post(SERVER_API_URL, payload, makeAxiosOptions());
    if (response.status === 200 || response.status === 202) {
      console.log(`[${new Date().toLocaleTimeString()}] 🚀 Pushed punch emp_id=${empId} time=${iso} (status=${response.status})`);
    }
  } catch (postError) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Failed to push punch emp_id=${empId}:`, postError.message);
  }
};

async function startBridge() {
  let zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);

  let pollTimer = null;
  let lastPolledAt = null; // Date
  let reconnectScheduled = false;

  const clearPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const safeDisconnect = async () => {
    try {
      if (zkInstance && typeof zkInstance.disconnect === 'function') {
        await zkInstance.disconnect();
      }
    } catch {}
  };

  const scheduleReconnect = async (reason, delayMs = 10000) => {
    if (reconnectScheduled) return;
    reconnectScheduled = true;
    clearPolling();
    await safeDisconnect();
    console.error(`[${new Date().toLocaleTimeString()}] 🔁 Reconnecting bridge in ${Math.round(delayMs / 1000)}s. Reason: ${reason}`);
    setTimeout(startBridge, delayMs);
  };

  const pollOnce = async () => {
    console.log(`[${new Date().toLocaleTimeString()}] 📥 Polling device logs...`);

    // zkteco-js has different method names across versions; prefer getAttendances.
    const getAttendancesFn = zkInstance.getAttendances || zkInstance.getAttendancesLog || zkInstance.getAttendances;
    if (typeof getAttendancesFn !== 'function') {
      console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Polling skipped: zkInstance.getAttendances() not available in this library version.`);
      return;
    }

    const logs = await getAttendancesFn.call(zkInstance);
    const rows = Array.isArray(logs?.data) ? logs.data : Array.isArray(logs) ? logs : [];

    const { startOfYesterday, startOfTomorrow } = getDateRangeForTodayAndYesterday();

    // Filter incrementally to avoid re-sending huge history each poll.
    // Keep a small overlap window to tolerate clock jitter and missed updates.
    const overlapMs = 2 * 60 * 1000;
    const cutoff = lastPolledAt ? new Date(lastPolledAt.getTime() - overlapMs) : null;

    let newest = lastPolledAt;
    let processed = 0;

    for (const log of rows) {
      const empId = log?.deviceUserId ?? log?.userId ?? log?.uid ?? log?.PIN ?? log?.emp_id;
      const rt = log?.recordTime ?? log?.timestamp ?? log?.time ?? log?.logTime;
      const dt = safeParseDate(rt);
      if (!empId || !dt) continue;

      // Requirement: keep only yesterday + today punches from device pull.
      if (dt < startOfYesterday || dt >= startOfTomorrow) continue;

      if (cutoff && dt <= cutoff) continue;

      await pushToServer({
        userId: empId,
        recordTime: dt,
        type: normalizePunchType(log?.type ?? log?.state ?? log?.status ?? log?.punch, dt),
        deviceId: DEVICE_ID,
        raw: { source: 'poll', log }
      });

      processed += 1;
      if (POLL_PUSH_DELAY_MS > 0) {
        await sleep(POLL_PUSH_DELAY_MS);
      }

      if (!newest || dt > newest) newest = dt;
    }

    if (newest) lastPolledAt = newest;
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Poll cycle complete. Total logs=${rows.length}, processed=${processed}`);
  };

  const startPolling = () => {
    clearPolling();
    pollTimer = setInterval(async () => {
      try {
        await pollOnce();
      } catch (err) {
        const details = unwrapError(err);
        console.error(`[${new Date().toLocaleTimeString()}] ❌ Polling error:`, details);
        if (isDeviceConnectionError(err)) {
          await scheduleReconnect(details?.message || 'device connection error while polling', 10000);
        }
      }
    }, POLL_INTERVAL_MS);

    // Run once immediately so backup starts without waiting first 5-minute interval.
    pollOnce().catch(async (err) => {
      const details = unwrapError(err);
      console.error(`[${new Date().toLocaleTimeString()}] ❌ Initial poll error:`, details);
      if (isDeviceConnectionError(err)) {
        await scheduleReconnect(details?.message || 'device connection error on initial poll', 10000);
      }
    });
  };

  try {  
    console.log(`[${new Date().toLocaleTimeString()}] Connecting to biometric device at ${DEVICE_IP}...`);  
    await zkInstance.createSocket();  
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Connected to device! Listening for real-time punches...`);  

    // Get live notifications  
    zkInstance.getRealTimeLogs(async (data) => {  
        const empId = data?.userId ?? data?.deviceUserId ?? data?.uid;
        const deviceTime = data?.recordTime ?? data?.timestamp ?? data?.time;
        console.log(`[${new Date().toLocaleTimeString()}] 🔔 Realtime punch: ${empId}`);

        await pushToServer({
          userId: empId,
          recordTime: deviceTime,
          type: normalizePunchType(data?.type ?? data?.state ?? data?.status ?? data?.punch, deviceTime),
          deviceId: DEVICE_ID,
          raw: { source: 'realtime', data }
        });
    });  

    // Start polling fallback (VERY IMPORTANT) – recovers missed realtime punches.
    startPolling();

  } catch (e) {  
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Connection Error:`);
    console.error(e);
    console.error('Connection error details:', unwrapError(e));
    console.log("Retrying in 10 seconds...");  
    clearPolling();
    await scheduleReconnect('initial connect failure', 10000);
  }
}

// Keep the process alive and handle errors
process.on('uncaughtException', (err) => {
  console.error('Fatal Error:', err);
  setTimeout(startBridge, 5000);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

startBridge();
