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
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    const todayDash = today.toLocaleDateString('en-CA', options);
    const yesterdayDash = yesterday.toLocaleDateString('en-CA', options);

    // 🎯 Use Month/Day only for matching (Ignoring incorrect Year in device)
    const matchesDate = (logDate, targetDate) => {
        return logDate.getMonth() === targetDate.getMonth() && logDate.getDate() === targetDate.getDate();
    };

    console.log(`📥 Fetching logs for Today (${todayDash}) and Yesterday (${yesterdayDash})...`);
    
    // 1. Fetch valid Employee IDs from the server to filter the sync
    let validEmpIds = [];
    try {
        const empIdsUrl = SERVER_API_URL.replace('/log', '/emp-ids');
        const res = await axios.get(empIdsUrl);
        validEmpIds = Array.isArray(res.data) ? res.data : [];
        console.log(`✅ Loaded ${validEmpIds.length} registered employees for log filtering.`);
    } catch (err) {
        console.warn("⚠️ Failed to load Employee IDs from server. Defaulting to sync ALL found logs.");
    }

    // 2. Fetch logs from device
    const logs = await zkInstance.getAttendances();
    if (!logs || !logs.data || logs.data.length === 0) {
      console.log("⚠️ No logs found on device memory");
      return;
    }

    // 3. Filter for Today + Yesterday AND valid Emp IDs
    const relevantLogs = logs.data.filter(log => {
        const timeValue = log.record_time || log.recordTime;
        const id = String(log.user_id || log.deviceUserId || log.userId || log.pin || '').trim();
        if (!timeValue || !id) return false;
        
        // Filter by Employee ID if list exists
        if (validEmpIds.length > 0 && !validEmpIds.includes(id)) return false;

        const logDate = new Date(timeValue);
        return matchesDate(logDate, today) || matchesDate(logDate, yesterday);
    });

    if (relevantLogs.length === 0) {
        console.log(`📊 No matching logs found for the filtered users and target dates.`);
        return;
    }

    // 4. Group by User ID AND Date (grouping by date ensures we get min/max for each day)
    const userDateGroups = {};
    relevantLogs.forEach(entry => {
        const id = String(entry.user_id || entry.deviceUserId || entry.userId || entry.pin || '').trim();
        const dateKey = new Date(entry.record_time || entry.recordTime).toLocaleDateString('en-CA', options);
        const groupKey = `${id}|${dateKey}`;
        if (!userDateGroups[groupKey]) userDateGroups[groupKey] = [];
        userDateGroups[groupKey].push(entry);
    });

    const finalUploadList = [];
    for (const key in userDateGroups) {
        const sorted = userDateGroups[key].sort((a, b) => 
            new Date(a.record_time || a.recordTime) - new Date(b.record_time || b.recordTime)
        );
        
        // Earliest (IN)
        finalUploadList.push(sorted[0]);
        // Latest (OUT) for that day
        if (sorted.length > 1) {
            finalUploadList.push(sorted[sorted.length - 1]);
        }
    }

    console.log(`📊 Logs found: ${relevantLogs.length}. (Uploading Summary: ${finalUploadList.length} logs for ${Object.keys(userDateGroups).length} user-day pairs)`);

    // 5. Upload relevant summaries
    for (const log of finalUploadList) {
      await pushToServer(log, { skipRebuild: true });
    }

    console.log("✅ Sync completed. Processing attendance totals...");

    // Trigger rebuild for Today and Yesterday
    try {
        const rebuildUrl = SERVER_API_URL.replace('/log', '/rebuild-today'); 
        console.log(`🔄 Recalculating attendance for Today (${todayDash})...`);
        await axios.post(rebuildUrl, { fromDate: todayDash, toDate: todayDash });
        
        console.log(`🔄 Recalculating attendance for Yesterday (${yesterdayDash})...`);
        await axios.post(rebuildUrl, { fromDate: yesterdayDash, toDate: yesterdayDash });
        
        console.log("🌟 Attendance records for Today and Yesterday are now UP TO DATE!");
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