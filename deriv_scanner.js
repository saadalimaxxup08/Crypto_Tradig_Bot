/**
 * Deriv MTF 15m Options Scanner Background Runner Daemon
 * Runs locally and triggers the Next.js scanner API route every 30 seconds.
 * Built using native Node.js 'http' to have zero dependencies.
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const CRON_PATH = '/api/deriv/cron';

console.log('========================================================');
console.log('🚀 DERIV 15M OPTIONS SCANNER RUNNER STARTED');
console.log(`📡 Target path: http://localhost:${PORT}${CRON_PATH}`);
console.log('⏰ Trigger frequency: Every 30 seconds');
console.log('========================================================');

function triggerScan() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] 📡 Triggering options scan...`);

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: CRON_PATH,
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache'
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const data = JSON.parse(body);
          console.log(`[${timestamp}] 🟢 Scan response success!`);
          if (data.logs && data.logs.length > 0) {
            console.log('Latest Logs from Server:');
            data.logs.slice(-3).forEach(log => console.log(`   -> ${log}`));
          }
        } catch (e) {
          console.log(`[${timestamp}] 🟢 Scan hit successfully but output could not be parsed.`);
        }
      } else {
        console.error(`[${timestamp}] 🔴 Server returned error status: ${res.statusCode}`);
        console.error(`   Details: ${body}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[${timestamp}] 🔴 Connection failed: ${err.message}`);
    console.error('   Ensure your Next.js app is running on npm run dev / port 3000.');
  });

  req.end();
}

// Run immediately on start
triggerScan();

// Repeat every 30 seconds
setInterval(triggerScan, 30000);
