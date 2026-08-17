async function triggerAndTest() {
  try {
    console.log('1. Hitting Next.js status endpoint to trigger auto-spawner...');
    const triggerRes = await fetch('http://localhost:3000/api/whatsapp/status');
    const triggerData = await triggerRes.json();
    console.log('Trigger Response:', triggerData);

    console.log('\nWaiting 4 seconds for WhatsApp bridge to boot up and connect...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    console.log('\n2. Querying status again...');
    const statusRes = await fetch('http://localhost:3000/api/whatsapp/status');
    const statusData = await statusRes.json();
    console.log('Updated Status Response:', statusData);

    if (statusData.status === 'connected') {
      console.log('\n✅ Bridge is connected! Sending live test WhatsApp alert...');
      // Load config
      const fs = require('fs');
      const path = require('path');
      const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'whatsapp_config.json'), 'utf-8'));
      
      const testMessage = `🔔 *[TEST] LIVE SIGNAL FORWARDED SUCCESS*\n\n` +
        `Bot successfully connected your WhatsApp account. Live signal alerts will be forwarded directly here.\n\n` +
        `*Expected Win Chance:* \`72.5% (29/40 wins)\`\n` +
        `*Expected Net Profit:* \`+0.3200 USDT\``;

      for (const recipient of config.whatsapp_recipients) {
        console.log(`Sending to ${recipient}...`);
        const sendRes = await fetch('http://localhost:3001/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: recipient, message: testMessage }),
        });
        const sendData = await sendRes.json();
        console.log(`Send Response for ${recipient}:`, sendData);
      }
    } else {
      console.log('\n❌ Bridge is still connecting or disconnected. Please check whatsapp-bridge.log!');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}
triggerAndTest();
