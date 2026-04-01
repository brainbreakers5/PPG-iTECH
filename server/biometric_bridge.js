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
      type: type || (dt ? (dt.getHours() < 12 ? 'IN' : 'OUT') : (new Date().getHours() < 12 ? 'IN' : 'OUT')),
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

  const startPolling = () => {
    clearPolling();
    pollTimer = setInterval(async () => {
      try {
        console.log(`[${new Date().toLocaleTimeString()}] 📥 Polling device logs...`);

        // zkteco-js has different method names across versions; prefer getAttendances.
        const getAttendancesFn = zkInstance.getAttendances || zkInstance.getAttendancesLog || zkInstance.getAttendances;
        if (typeof getAttendancesFn !== 'function') {
          console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Polling skipped: zkInstance.getAttendances() not available in this library version.`);
          return;
        }

        const logs = await getAttendancesFn.call(zkInstance);
        const rows = Array.isArray(logs?.data) ? logs.data : Array.isArray(logs) ? logs : [];

        // Filter incrementally to avoid re-sending huge history each poll.
        // Keep a small overlap window to tolerate clock jitter and missed updates.
        const overlapMs = 2 * 60 * 1000;
        const cutoff = lastPolledAt ? new Date(lastPolledAt.getTime() - overlapMs) : null;

        let newest = lastPolledAt;
        for (const log of rows) {
          const empId = log?.deviceUserId ?? log?.userId ?? log?.uid ?? log?.PIN ?? log?.emp_id;
          const rt = log?.recordTime ?? log?.timestamp ?? log?.time ?? log?.logTime;
          const dt = safeParseDate(rt);
          if (!empId || !dt) continue;

          if (cutoff && dt <= cutoff) continue;

          await pushToServer({
            userId: empId,
            recordTime: dt,
            deviceId: DEVICE_ID,
            raw: { source: 'poll', log }
          });

          if (!newest || dt > newest) newest = dt;
        }

        if (newest) lastPolledAt = newest;
      } catch (err) {
        console.log(`[${new Date().toLocaleTimeString()}] Polling error:`, err.message);
      }
    }, POLL_INTERVAL_MS);
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
          type: data?.type,
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
    await safeDisconnect();
    setTimeout(startBridge, 10000);  
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
