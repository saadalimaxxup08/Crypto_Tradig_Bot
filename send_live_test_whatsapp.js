const fs = require('fs');
const path = require('path');

async function sendLiveTest() {
  console.log('Reading WhatsApp recipients config...');
  const configPath = path.join(__dirname, 'whatsapp_config.json');
  if (!fs.existsSync(configPath)) {
    console.error('Config file whatsapp_config.json does not exist.');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log('Active configuration:', config);

  if (!config.whatsapp_recipients || config.whatsapp_recipients.length === 0) {
    console.error('No recipients found in config.');
    return;
  }

  const testMessage = `🔔 *[TEST] LIVE SIGNAL FORWARDED SUCCESS*\n\n` +
    `Bot successfully connected your WhatsApp account. Live signal alerts will be forwarded directly here.\n\n` +
    `*Expected Win Chance:* \`72.5% (29/40 wins)\`\n` +
    `*Expected Net Profit:* \`+0.3200 USDT\``;

  console.log('Sending test message to recipients...');
  for (const recipient of config.whatsapp_recipients) {
    try {
      console.log(`Sending to ${recipient}...`);
      const res = await fetch('http://localhost:3001/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipient, message: testMessage }),
      });
      const data = await res.json();
      console.log(`Response for ${recipient}:`, data);
    } catch (err) {
      console.error(`Failed to send to ${recipient}:`, err.message);
    }
  }
}

sendLiveTest();
