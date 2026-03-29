const ZKLib = require('zkteco-js');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const DEVICE_IP = '172.16.100.81';
const DEVICE_PORT = 4370;

const SERVER_API_URL =
  process.env.SERVER_API_BIOMETRIC_URL ||
  `http://localhost:${process.env.PORT || 5000}/api/biometric/log`;

let zkInstance;
let lastTimestamp = null; // for duplicate prevention

async function connectDevice() {
  zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);

  try {
    console.log(`🔌 Connecting to device ${DEVICE_IP}...`);
    await zkInstance.createSocket();
    console.log(`✅ Connected to device`);
  } catch (err) {
    console.error(`❌ Connection failed:`, err.message);
    setTimeout(connectDevice, 10000);
  }
}

async function pushToServer(log, options = {}) {
  try {
    const axiosOptions = {};

    if (process.env.DISABLE_TLS_VERIFY === '1') {
      axiosOptions.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    }

    // Identify user ID and time safely (Handles underscore and camelCase)
    const rawId = log.user_id || log.deviceUserId || log.userId || log.pin;
    const empId = rawId ? String(rawId).trim() : "UNKNOWN";
    const timeValue = log.record_time || log.recordTime;

    if (!timeValue) return;

    // 🔥 YEAR CORRECTION: If device time is in 2000 but we want today, 
    // we use SERVER year for the API call to ensure it appears on dashboard.
    const logDate = new Date(timeValue);
    const serverNow = new Date();
    
    // Construct corrected date (use Server Year, but Log Month and Day)
    const correctedTimestamp = new Date(
        serverNow.getFullYear(),
        logDate.getMonth(),
        logDate.getDate(),
        logDate.getHours(),
        logDate.getMinutes(),
        logDate.getSeconds()
    );

    await axios.post(
      SERVER_API_URL,
      {
        user_id: empId,
        device_id: 'MAIN_DEVICE_01',
        timestamp: correctedTimestamp.toISOString(), 
        type: logDate.getHours() < 12 ? 'IN' : 'OUT',
        skipRebuild: options.skipRebuild || false // Efficiency for historical sync
      },
      axiosOptions
    );

    console.log(`🚀 Sent → User ${empId} @ ${correctedTimestamp.toLocaleString()} (Source: ${timeValue})`);
  } catch (err) {
    console.error(`❌ Push failed for User ${log.user_id || log.deviceUserId || log.userId || '??'}:`, err.message);
  }
}

async function syncPastData() {
  try {
    const options = { timeZone: 'Asia/Kolkata' };
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', options); // YYYY-MM-DD
    
    console.log(`📥 Fetching logs for TODAY (Any Month/Day matching ${today.getMonth() + 1}-${today.getDate()})...`);
    const logs = await zkInstance.getAttendances();

    if (!logs || !logs.data || logs.data.length === 0) {
      console.log("⚠️ No logs found on device memory");
      return;
    }

    // 🔥 Filter for TODAY only (Year-Agnostic match for Month and Day)
    const todayLogs = logs.data.filter(log => {
        const timeValue = log.record_time || log.recordTime;
        if (!timeValue) return false;
        
        const logDate = new Date(timeValue);
        // Match only Month and Date (because device clock might be set to year 2000 or similar)
        return logDate.getMonth() === today.getMonth() && logDate.getDate() === today.getDate();
    });

    if (todayLogs.length === 0) {
        console.log(`📊 Today's relevant logs: 0. Skipping sync.`);
        const lastLog = logs.data[logs.data.length - 1];
        console.log(`🔍 DEBUG: Last Log Date in device: ${new Date(lastLog.record_time || lastLog.recordTime).toLocaleString()}`);
        return;
    }

    // 🎯 Group by User ID and find Min/Max to get Earliest & Latest only
    const userGroups = {};
    todayLogs.forEach(entry => {
        const id = entry.user_id || entry.deviceUserId || entry.userId || entry.pin;
        if (!id) return;
        if (!userGroups[id]) userGroups[id] = [];
        userGroups[id].push(entry);
    });

    const bestLogs = [];
    for (const id in userGroups) {
        const sorted = userGroups[id].sort((a, b) => 
            new Date(a.record_time || a.recordTime) - new Date(b.record_time || b.recordTime)
        );
        
        bestLogs.push(sorted[0]);
        if (sorted.length > 1) {
            bestLogs.push(sorted[sorted.length - 1]);
        }
    }

    console.log(`📊 Today's relevant logs: ${todayLogs.length} found. (Pushing Earliest/Latest: ${bestLogs.length} total)`);

    const uniqueDates = new Set();
    let count = 0;

    for (const log of bestLogs) {
      await pushToServer(log, { skipRebuild: true });
      count++;
    }

    console.log("✅ Sync completed. Processing attendance totals...");

    // Trigger rebuild for Today
    console.log(`🔄 Updating dashboard calculations for ${todayStr}...`);
    try {
        const rebuildUrl = SERVER_API_URL.replace('/log', '/rebuild-today'); 
        await axios.post(rebuildUrl, {
            fromDate: todayStr,
            toDate: todayStr
        });
        console.log("🌟 Today's dashboard is now UP TO DATE!");
    } catch (rebuildErr) {
        console.error("❌ Failed to update dashboard stats:", rebuildErr.message);
    }
  } catch (err) {
    console.error("❌ Past sync error:", err.message);
  }
}

function startRealtime() {
  zkInstance.getRealTimeLogs(async (data) => {
    console.log(`🔔 Punch detected → ${data.userId}`);

    // ❗ Prevent duplicates
    if (lastTimestamp && data.recordTime <= lastTimestamp) {
      console.log("⚠️ Duplicate skipped");
      return;
    }

    lastTimestamp = data.recordTime;

    await pushToServer(data);
  });
}

async function startBridge() {
  await connectDevice();

  // 🔥 STEP 1: Sync past data
  await syncPastData();

  // 🔥 STEP 2: Start realtime listening
  startRealtime();
}

// Auto-reconnect on crash
process.on('uncaughtException', (err) => {
  console.error('💥 Fatal Error:', err);
  setTimeout(startBridge, 5000);
});

startBridge();