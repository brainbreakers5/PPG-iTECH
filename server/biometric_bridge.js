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
let validEmpIds = []; // Global filter for registered users (Synchronized with App)

async function connectDevice() {
  zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 30000, 4000);

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
    
    // 1. Fetch valid Employee IDs from the server (STRICT) -> Now moved to startBridge!

    // 2. Fetch logs from device
    const logs = await zkInstance.getAttendances();
    if (!logs || !logs.data || logs.data.length === 0) {
      console.log("⚠️ No logs found on device memory");
      return;
    }
    
    console.log(`🔍 DIAGNOSTIC: Successfully fetched ${logs.data.length} total raw logs from device memory.`);

    // 3. Filter for Today + Yesterday AND valid Emp IDs
    const relevantLogs = logs.data.filter(log => {
        const timeValue = log.record_time || log.recordTime;
        const rawId = String(log.user_id || log.deviceUserId || log.userId || log.pin || '').trim();
        if (!timeValue || !rawId) return false;
        
        // STRICT FILTER: Match registered IDs (Handle leading zeros e.g. '005001' vs '5001')
        const exactMatch = validEmpIds.includes(rawId);
        const fuzzyMatch = validEmpIds.includes(String(parseInt(rawId, 10)));
        
        if (!exactMatch && !fuzzyMatch) return false;

        const logDate = new Date(timeValue);
        return matchesDate(logDate, today) || matchesDate(logDate, yesterday);
    });

    if (relevantLogs.length === 0) {
        console.log(`📊 No matching logs found for today/yesterday for the ${validEmpIds.length} registered users.`);
        
        // 🎯 DEBUG Check if there were any logs at all for today that just didn't match IDs
        const anyTodayLogs = logs.data.filter(l => {
            const tv = l.record_time || l.recordTime;
            if(!tv) return false;
            return matchesDate(new Date(tv), today) || matchesDate(new Date(tv), yesterday);
        });
        
        if (anyTodayLogs.length > 0) {
            console.log(`🔍 DEBUG: Found ${anyTodayLogs.length} logs for today/yesterday, but their User IDs are NOT in our App!`);
            const sampleIds = [...new Set(anyTodayLogs.map(l => l.user_id || l.deviceUserId || l.userId || l.pin))].slice(0, 5);
            console.log(`🔍 DEBUG: Unmatched Device IDs: [${sampleIds.join(', ')}]`);
        }
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

    console.log(`📊 Logs found: ${relevantLogs.length}. (Uploading Summary: ${finalUploadList.length} logs for ${Object.keys(userDateGroups).length} matching user-day sessions)`);

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
    const id = String(data.user_id || data.deviceUserId || data.userId || data.pin || '').trim();
    console.log(`🔔 Punch detected → User ${id}`);

    // STRICT: Only push if the employee exists in our App's database
    if (validEmpIds.length > 0 && !validEmpIds.includes(id)) {
        console.log(`⚠️ Ignored punch for Unknown User: ${id} (Not in App list)`);
        return;
    }

    // ❗ Prevent duplicates (already exists in backend but good to have)
    const timeValue = data.record_time || data.recordTime;
    const currentTimeMs = new Date(timeValue).getTime();
    
    if (lastTimestamp && currentTimeMs <= new Date(lastTimestamp).getTime()) {
      console.log("⚠️ Duplicate realtime punch skipped");
      return;
    }

    lastTimestamp = timeValue;

    await pushToServer(data);
  });
}

async function updateValidEmpIds() {
    try {
        const empIdsUrl = SERVER_API_URL.replace('/log', '/emp-ids');
        const res = await axios.get(empIdsUrl);
        validEmpIds = Array.isArray(res.data) ? res.data : [];
        if (validEmpIds.length === 0) {
            console.error("❌ CRITICAL: No registered employees found in database. Check your Employee list!");
            return false;
        }
        console.log(`✅ Loaded ${validEmpIds.length} registered Employees. (IDs: ${validEmpIds.join(', ')})`);
        return true;
    } catch (err) {
        console.error(`❌ CRITICAL: Could not fetch Employee ID list from server. [Reason: ${err.message}]`);
        return false;
    }
}

async function startBridge() {
  // 🔥 STEP 1: Load Employee IDs from Web Server FIRST (so device doesn't time out while waiting)
  const idSuccess = await updateValidEmpIds();
  if (!idSuccess) {
      console.log("⚠️ Bridge will not start syncing until Server is online. Retrying in 10s...");
      setTimeout(startBridge, 10000);
      return;
  }

  // 🔥 STEP 2: Connect to the Biometric Device ONLY AFTER we are ready
  await connectDevice();

  // 🔥 STEP 3: Sync past data using the active, fresh socket
  await syncPastData();

  // 🔥 STEP 4: Start realtime listening
  startRealtime();
}

// Auto-reconnect on crash
process.on('uncaughtException', (err) => {
  console.error('💥 Fatal Error:', err);
  setTimeout(startBridge, 5000);
});

startBridge();