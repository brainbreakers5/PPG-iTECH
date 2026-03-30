const ZKLib = require('zkteco-js');
const axios = require('axios');

async function sync() {
  const DEVICE_IP = '172.16.100.81';
  const SERVER_URL = 'http://localhost:5000/api/biometric/log';
  
  console.log(`[SYNC] Connecting to device at ${DEVICE_IP}...`);
  const zkInstance = new ZKLib(DEVICE_IP, 4370, 10000, 4000);

  try {
    await zkInstance.createSocket();
    console.log(`[SYNC] ✅ Connected! Fetching all attendance logs...`);
    
    const logs = await zkInstance.getAttendances();
    console.log(`[SYNC] Total logs on device: ${logs.data.length}`);

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayLogs = logs.data.filter(l => {
        const d = new Date(l.recordTime);
        const logDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return logDateStr === todayStr;
    });

    console.log(`[SYNC] Found ${todayLogs.length} logs for today.`);

    let success = 0;
    for (const log of todayLogs) {
        try {
            await axios.post(SERVER_URL, {
                emp_id: log.deviceUserId,
                timestamp: log.recordTime,
                type: new Date(log.recordTime).getHours() < 12 ? 'IN' : 'OUT',
                skipDuplicateGuard: true // Don't block because we are backfilling
            });
            success++;
        } catch (err) {
            // Silently skip duplicates if server returns error or handle errors
            if (!err.response || err.response.status !== 400) {
                console.error(`Failed to push log for ${log.deviceUserId}:`, err.message);
            }
        }
    }

    console.log(`[SYNC] Successfully synced ${success} logs to server.`);
    process.exit(0);
  } catch (err) {
    console.error(`[SYNC] FATAL:`, err.message);
    process.exit(1);
  }
}

sync();
