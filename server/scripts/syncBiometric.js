const ZKLib = require('zkteco-js');

/**
 * Syncs attendance data from a physical ZKteco device to the server API.
 * This script uses 'zkteco-js' (instead of node-zklib) as it is already in your package.json.
 */
async function syncBiometricDevice(deviceIp, devicePort = 4370) {
    const zk = new ZKLib(deviceIp, devicePort, 10000, 4000);
    
    try {
        console.log(`[SYNC] Connecting to device at ${deviceIp}:${devicePort}...`);
        await zk.createSocket();
        console.log('[SYNC] Connected successfully.');

        // 1. Fetch all attendance logs from device memory
        const logs = await zk.getAttendances();
        console.log(`[SYNC] Total logs retrieved: ${logs.data.length}`);

        if (logs.data.length === 0) {
            console.log('[SYNC] No logs to process.');
            return;
        }

        // 2. Push logs to server API
        console.log('[SYNC] Pushing logs to server...');
        let success = 0;
        let errors = 0;
        
        // Track unique dates to rebuild at the end (optimization)
        const uniqueDates = new Set();

        for (const log of logs.data) {
            try {
                // Formatting timestamp as ISO
                const recordTime = log.recordTime; 
                const dateKey = new Date(recordTime).toLocaleDateString('en-CA'); // YYYY-MM-DD
                uniqueDates.add(dateKey);

                const response = await fetch('http://localhost:5000/api/biometric/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: log.deviceUserId, // ZKteco-js uses deviceUserId
                        timestamp: recordTime,
                        device_ip: deviceIp,
                        skipRebuild: true // OPTIMIZATION: Don't rebuild DB for every single log
                    })
                });

                if (response.ok) {
                    success++;
                } else {
                    const errTxt = await response.text();
                    console.warn(`[SYNC] Failed to push log for user ${log.deviceUserId} at ${recordTime}: ${errTxt}`);
                    errors++;
                }
            } catch (err) {
                console.error(`[SYNC] Error pushing log:`, err.message);
                errors++;
            }

            if ((success + errors) % 100 === 0) {
                console.log(`[SYNC] Progress: ${success + errors}/${logs.data.length}...`);
            }
        }

        console.log(`[SYNC] Finished pushing logs. Success: ${success}, Errors: ${errors}`);

        // 3. Trigger a full rebuild for the affected dates to update attendance summaries correctly
        if (uniqueDates.size > 0) {
            console.log(`[SYNC] Triggering attendance rebuild for ${uniqueDates.size} dates...`);
            const datesArray = Array.from(uniqueDates).sort();
            const fromDate = datesArray[0];
            const toDate = datesArray[datesArray.length - 1];

            try {
                const rebuildResponse = await fetch('http://localhost:5000/api/biometric/rebuild-today', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fromDate, toDate })
                });
                
                if (rebuildResponse.ok) {
                    console.log(`[SYNC] Attendance summaries updated successfully via rebuild-range (${fromDate} to ${toDate}).`);
                } else {
                    console.error('[SYNC] Failed to trigger attendance rebuild.');
                }
            } catch (rebuildErr) {
                console.error('[SYNC] Error during rebuild trigger:', rebuildErr.message);
            }
        }

    } catch (e) {
        console.error('[SYNC] Fatal error during sync:', e.message);
    } finally {
        try {
            await zk.disconnect();
        } catch (e) {}
    }
}

// Example usage:
// syncBiometricDevice('172.16.100.81'); 

module.exports = { syncBiometricDevice };
