const ZKLib = require('zkteco-js');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

/**
 * BIOMETRIC REAL-TIME BRIDGE
 * This script connects to your device (172.16.100.81) and pushes data 
 * to the web application as soon as someone punches their finger.
 */

const DEVICE_IP = '172.16.100.81';
const DEVICE_PORT = 80;
const SERVER_API_URL = process.env.SERVER_API_BIOMETRIC_URL || `http://localhost:${process.env.PORT || 5000}/api/biometric/log`; // Adjust if server is remote

async function startBridge() {
    let zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);

    try {
        console.log(`[${new Date().toLocaleTimeString()}] Connecting to biometric device at ${DEVICE_IP}...`);
        await zkInstance.createSocket();
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Connected to device! Listening for real-time punches...`);

        // Get live notifications
        zkInstance.getRealTimeLogs(async (data) => {
            console.log(`[${new Date().toLocaleTimeString()}] 🔔 Punch detected! User ID: ${data.userId}`);

            try {
                // Push to our web server API
                const axiosOptions = {};
                if (process.env.DISABLE_TLS_VERIFY === '1') {
                    axiosOptions.httpsAgent = new https.Agent({ rejectUnauthorized: false });
                }
                const response = await axios.post(SERVER_API_URL, {
                    emp_id: data.userId.toString(),
                    device_id: 'MAIN_DEVICE_01',
                    timestamp: new Date().toISOString(),
                    type: new Date().getHours() < 12 ? 'IN' : 'OUT' // Automatic detection or use device type if available
                }, axiosOptions);

                if (response.status === 200) {
                    console.log(`[${new Date().toLocaleTimeString()}] 🚀 Data pushed to server successfully.`);
                }
            } catch (postError) {
                console.error(`[${new Date().toLocaleTimeString()}] ❌ Failed to push data to server:`, postError.message);
            }
        });

    } catch (e) {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ Connection Error:`, e.message);
        console.log("Retrying in 10 seconds...");
        setTimeout(startBridge, 10000);
    }
}

// Keep the process alive and handle errors
process.on('uncaughtException', (err) => {
    console.error('Fatal Error:', err);
    setTimeout(startBridge, 5000);
});

startBridge();
