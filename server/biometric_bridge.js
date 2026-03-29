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

    // Identify user ID safely (ZK devices use different names depending on library version)
    const rawId = log.deviceUserId || log.userId || log.pin;
    const empId = rawId ? String(rawId).trim() : "UNKNOWN";

    await axios.post(
      SERVER_API_URL,
      {
        user_id: empId,
        device_id: 'MAIN_DEVICE_01',
        timestamp: log.recordTime, // 🔥 DEVICE TIME (Past and Realtime)
        type: new Date(log.recordTime).getHours() < 12 ? 'IN' : 'OUT',
        skipRebuild: options.skipRebuild || false // Efficiency for historical sync
      },
      axiosOptions
    );

    console.log(`🚀 Sent → User ${empId} @ ${log.recordTime}`);
  } catch (err) {
    console.error(`❌ Push failed for User ${log.deviceUserId || log.userId || '??'}:`, err.message);
  }
}

async function syncPastData() {
  try {
    console.log("📥 Fetching past attendance logs from device memory...");
    const logs = await zkInstance.getAttendances();

    if (!logs || !logs.data || logs.data.length === 0) {
      console.log("⚠️ No past data found or device memory empty");
      return;
    }

    console.log(`📊 Total logs available: ${logs.data.length}`);

    const uniqueDates = new Set();
    let count = 0;

    for (const log of logs.data) {
      await pushToServer(log, { skipRebuild: true });
      lastTimestamp = log.recordTime;
      uniqueDates.add(new Date(log.recordTime).toLocaleDateString('en-CA'));
      count++;
      if (count % 50 === 0) console.log(`Progress: ${count}/${logs.data.length}...`);
    }

    console.log("✅ Past data sync completed. Stored logs in database.");

    // Trigger rebuild for all affected days at once (High efficiency)
    if (uniqueDates.size > 0) {
        const sorted = Array.from(uniqueDates).sort();
        console.log(`🔄 Triggering attendance rebuild for range: ${sorted[0]} to ${sorted[sorted.length-1]}`);
        try {
            const rebuildUrl = SERVER_API_URL.replace('/log', '/rebuild-today'); 
            await axios.post(rebuildUrl, {
                fromDate: sorted[0],
                toDate: sorted[sorted.length - 1]
            });
            console.log("🌟 Attendance records successfully updated/recalculated!");
        } catch (rebuildErr) {
            console.error("❌ Failed to trigger rebuild:", rebuildErr.message);
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