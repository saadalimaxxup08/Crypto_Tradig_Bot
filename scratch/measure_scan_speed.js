const http = require('http');

console.log('--- MEASURING SCAN DURATION FOR ALL 86 SYMBOLS ---');
const start = Date.now();

http.get('http://localhost:3000/api/deriv/cron', (res) => {
  console.log('STATUS:', res.statusCode);
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('DURATION:', ((Date.now() - start) / 1000).toFixed(2), 'seconds');
    try {
      const data = JSON.parse(body);
      if (data.logs) {
        console.log('TOTAL LOG STATEMENTS GENERATED:', data.logs.length);
        console.log('\n--- FIRST 5 LOG LINES ---');
        data.logs.slice(0, 5).forEach(l => console.log('  ', l));
        console.log('\n--- LAST 5 LOG LINES ---');
        data.logs.slice(-5).forEach(l => console.log('  ', l));
      }
    } catch (e) {
      console.log('Could not parse JSON. Body:', body.slice(0, 300));
    }
  });
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
