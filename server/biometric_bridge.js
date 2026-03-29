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
let validEmpIds = []; // Global filter for registered users (Synchronized with App)

const parseDeviceTime = (timeValue) => {
  if (!timeValue) return new Date(); // Fallback to current server time if device misses time field
  if (timeValue instanceof Date && !Number.isNaN(timeValue.getTime())) return timeValue;

  if (typeof timeValue === 'number') {
    const ms = timeValue < 1e12 ? timeValue * 1000 : timeValue;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(timeValue).trim();
  if (!raw) return null;

  const mdMatch = raw.match(/^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mdMatch) {
    const now = new Date();
    const month = parseInt(mdMatch[1], 10) - 1;
    const day = parseInt(mdMatch[2], 10);
    const hour = parseInt(mdMatch[3], 10);
    const minute = parseInt(mdMatch[4], 10);
    const second = parseInt(mdMatch[5] || '0', 10);
    const d = new Date(now.getFullYear(), month, day, hour, minute, second);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const d = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDateKey = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
    const timeValue = log.record_time || log.recordTime || log.time; // Added log.time for real-time compatibility
    const missingTime = !timeValue;

    if (process.env.BIOMETRIC_DEBUG === '1') {
      console.log(`📡 Attempting push for User ${empId}. Raw time field: ${timeValue}`);
    }

    if (missingTime) {
      console.warn(`⚠️ Missing device timestamp for User ${empId}. Using server time.`);
    }

    const parsedLogDate = parseDeviceTime(timeValue);
    if (!parsedLogDate) return;

    // 🔥 YEAR CORRECTION: If device time is in 2000 but we want today, 
    // we use SERVER year for the API call to ensure it appears on dashboard.
    const logDate = parsedLogDate;
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

    const response = await axios.post(
      SERVER_API_URL,
      {
        user_id: empId,
        device_id: 'MAIN_DEVICE_01',
        timestamp: correctedTimestamp.toISOString(), 
        type: logDate.getHours() < 12 ? 'IN' : 'OUT',
        skipRebuild: options.skipRebuild || false, // Efficiency for historical sync
        skipDuplicateGuard: options.skipDuplicateGuard || false
      },
      axiosOptions
    );

    console.log(`🚀 Sent → User ${empId} @ ${correctedTimestamp.toLocaleString()} (Source: ${timeValue})`);
    if (response?.data?.skipped) {
      console.warn(`⚠️ Server skipped punch for ${empId}: ${response.data.reason || 'UNKNOWN'}`);
    }
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

    if (process.env.BIOMETRIC_DEBUG === '1') {
      const sample = logs.data.slice(0, 5).map((log) => {
        const timeValue = log.record_time || log.recordTime;
        const rawId = String(log.user_id || log.deviceUserId || log.userId || log.pin || '').trim();
        const parsedDate = parseDeviceTime(timeValue);
        const isValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
        const exactMatch = rawId ? validEmpIds.includes(rawId) : false;
        const fuzzyMatch = rawId ? validEmpIds.includes(String(parseInt(rawId, 10))) : false;
        return {
          rawId,
          timeValue,
          isValidDate,
          parsedIso: isValidDate ? parsedDate.toISOString() : null,
          exactMatch,
          fuzzyMatch,
        };
      });
      console.log('🔎 DEBUG SAMPLE (first 5 logs):', sample);
    }

    const filterByDates = (targetDates) => logs.data.filter(log => {
      const timeValue = log.record_time || log.recordTime;
        const rawId = String(log.user_id || log.deviceUserId || log.userId || log.pin || '').trim();
      if (!timeValue || !rawId) return false;
        
        // STRICT FILTER: Match registered IDs (Handle leading zeros e.g. '005001' vs '5001')
        const exactMatch = validEmpIds.includes(rawId);
        const fuzzyMatch = validEmpIds.includes(String(parseInt(rawId, 10)));
        
        if (!exactMatch && !fuzzyMatch) return false;

        const logDate = parseDeviceTime(timeValue);
        if (!logDate) return false;
        return targetDates.some((d) => matchesDate(logDate, d));
    });

      // 3. Filter for Today + Yesterday AND valid Emp IDs
      let relevantLogs = filterByDates([today, yesterday]);
      let rebuildDates = [todayDash, yesterdayDash];

    if (process.env.BIOMETRIC_DEBUG === '1' && relevantLogs.length > 0) {
      const matchedIds = [...new Set(relevantLogs.map(l => String(l.user_id || l.deviceUserId || l.userId || l.pin || '').trim()))]
        .filter(Boolean)
        .slice(0, 25);
      console.log(`✅ DEBUG: Matched device IDs (sample up to 25): [${matchedIds.join(', ')}]`);
    }

    if (relevantLogs.length === 0) {
        console.log(`📊 No matching logs found for today/yesterday for the ${validEmpIds.length} registered users.`);
        
        // 🎯 DEBUG Check if there were any logs at all for today that just didn't match IDs
        const anyTodayLogs = logs.data.filter(l => {
          const tv = l.record_time || l.recordTime;
          if (!tv) return false;
          const parsed = parseDeviceTime(tv);
          if (!parsed) return false;
          return matchesDate(parsed, today) || matchesDate(parsed, yesterday);
        });
        
        if (anyTodayLogs.length > 0) {
            console.log(`🔍 DEBUG: Found ${anyTodayLogs.length} logs for today/yesterday, but their User IDs are NOT in our App!`);
            const sampleIds = [...new Set(anyTodayLogs.map(l => l.user_id || l.deviceUserId || l.userId || l.pin))].slice(0, 5);
            console.log(`🔍 DEBUG: Unmatched Device IDs: [${sampleIds.join(', ')}]`);
        }

        // Fallback: use latest two available dates from valid employee logs
        const validDatedLogs = logs.data
          .map((log) => {
            const timeValue = log.record_time || log.recordTime;
            const rawId = String(log.user_id || log.deviceUserId || log.userId || log.pin || '').trim();
            if (!timeValue || !rawId) return null;

            const exactMatch = validEmpIds.includes(rawId);
            const fuzzyMatch = validEmpIds.includes(String(parseInt(rawId, 10)));
            if (!exactMatch && !fuzzyMatch) return null;

            const logDate = parseDeviceTime(timeValue);
            if (!logDate) return null;
            return { log, logDate };
          })
          .filter(Boolean);

        if (validDatedLogs.length === 0) return;

        const mostRecent = validDatedLogs.reduce((max, entry) => {
          return entry.logDate > max ? entry.logDate : max;
        }, validDatedLogs[0].logDate);

        const prevDate = new Date(mostRecent);
        prevDate.setDate(prevDate.getDate() - 1);

        const fallbackTargets = [mostRecent, prevDate];
        rebuildDates = fallbackTargets.map((d) => toDateKey(d));
        console.log(`🔁 Fallback: syncing latest device dates [${toDateKey(mostRecent)}, ${toDateKey(prevDate)}] for registered employees.`);
        relevantLogs = filterByDates(fallbackTargets);

        if (relevantLogs.length === 0) return;
    }

    console.log(`📊 Logs found: ${relevantLogs.length}. Uploading all matching punches...`);

    // 4. Upload all relevant logs (no data loss)
    for (const log of relevantLogs) {
      await pushToServer(log, { skipRebuild: true, skipDuplicateGuard: true });
    }

    console.log("✅ Sync completed. Processing attendance totals...");

    // Trigger rebuild for the dates that were actually synced
    try {
        const rebuildUrl = SERVER_API_URL.replace('/log', '/rebuild-today'); 
      for (const dateStr of rebuildDates) {
        console.log(`🔄 Recalculating attendance for ${dateStr}...`);
        await axios.post(rebuildUrl, { fromDate: dateStr, toDate: dateStr });
      }
      console.log(`🌟 Attendance records for ${rebuildDates.join(', ')} are now UP TO DATE!`);
    } catch (rebuildErr) {
        console.error("❌ Failed to update dashboard stats:", rebuildErr.message);
    }
  } catch (err) {
    console.error("❌ Past sync error:", err.message);
  }
}

function startRealtime() {
  console.log('🟢 Realtime listener started (waiting for new punches)...');
  zkInstance.getRealTimeLogs(async (data) => {
    try {
      const rawId = String(data.user_id || data.deviceUserId || data.userId || data.pin || '').trim();
      const id = rawId;
      console.log(`🔔 Punch detected → User ${id}`);

      // STRICT: Only push if the employee exists in our App's database
      // Using fuzzy matching to handle leading zero differences (e.g. 005001 vs 5001)
      const exactMatch = validEmpIds.includes(id);
      const fuzzyMatch = validEmpIds.includes(String(parseInt(id, 10)));

      if (validEmpIds.length > 0 && !exactMatch && !fuzzyMatch) {
          console.log(`⚠️ Ignored punch for Unknown User: ${id} (Not in App list)`);
          return;
      }

      const matchId = exactMatch ? id : String(parseInt(id, 10));
      // Replace with normalized ID in the push
      data.user_id = matchId; 

      await pushToServer(data, { skipDuplicateGuard: false });
    } catch (realtimeErr) {
      console.error('❌ Error processing real-time punch:', realtimeErr.message);
    }
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

  // 🔥 STEP 3: Start realtime listening immediately
  startRealtime();

  // 🔥 STEP 4: Sync past data only if explicitly enabled (run in background)
  if (process.env.BIOMETRIC_SYNC_ON_START === '1') {
    syncPastData().catch((err) => {
      console.error('❌ Past sync failed:', err.message);
    });
  } else {
    console.log('⏭️  Past sync skipped (set BIOMETRIC_SYNC_ON_START=1 to enable)');
  }
}

// Auto-reconnect on crash
process.on('uncaughtException', (err) => {
  console.error('💥 Fatal Error:', err);
  setTimeout(startBridge, 5000);
});

startBridge();