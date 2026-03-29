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

    await axios.post(
      SERVER_API_URL,
      {
        user_id: empId,
        device_id: 'MAIN_DEVICE_01',
        timestamp: timeValue, 
        type: new Date(timeValue).getHours() < 12 ? 'IN' : 'OUT',
        skipRebuild: options.skipRebuild || false // Efficiency for historical sync
      },
      axiosOptions
    );

    console.log(`🚀 Sent → User ${empId} @ ${timeValue}`);
  } catch (err) {
    console.error(`❌ Push failed for User ${log.user_id || log.deviceUserId || log.userId || '??'}:`, err.message);
  }
}

async function syncPastData() {
  try {
    // 🎯 Robust Date Calculation for India (+05:30)
    const options = { timeZone: 'Asia/Kolkata' };
    const todayStr = new Date().toLocaleDateString('en-CA', options); // YYYY-MM-DD
    
    console.log(`📥 Fetching logs for TODAY (${todayStr}) only...`);
    const logs = await zkInstance.getAttendances();

    if (!logs || !logs.data || logs.data.length === 0) {
      console.log("⚠️ No logs found on device memory");
      return;
    }

    // 🔥 Filter for TODAY only (handling underscore naming)
    const todayLogs = logs.data.filter(log => {
        const timeValue = log.record_time || log.recordTime;
        if (!timeValue) return false;
        return new Date(timeValue).toLocaleDateString('en-CA', options) === todayStr;
    });

    if (todayLogs.length === 0) {
        console.log(`📊 Today's relevant logs: 0. Skipping sync.`);
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
        // Sort by time
        const sorted = userGroups[id].sort((a, b) => 
            new Date(a.record_time || a.recordTime) - new Date(b.record_time || b.recordTime)
        );
        
        // Push the Earliest (IN)
        bestLogs.push(sorted[0]);
        // Push the Latest (OUT) if it's different (e.g., user has more than 1 punch)
        if (sorted.length > 1) {
            bestLogs.push(sorted[sorted.length - 1]);
        }
    }

    console.log(`📊 Today's relevant logs: ${todayLogs.length} found. (Pushing Earliest/Latest: ${bestLogs.length} total)`);

    const uniqueDates = new Set();
    let count = 0;

    for (const log of bestLogs) {
      const timeValue = log.record_time || log.recordTime;
      await pushToServer(log, { skipRebuild: true });
      lastTimestamp = timeValue;
      uniqueDates.add(new Date(timeValue).toLocaleDateString('en-CA', options));
      count++;
    }

    console.log("✅ Sync completed. Processing attendance totals...");

    // Trigger rebuild for Today only
    if (uniqueDates.size > 0) {
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