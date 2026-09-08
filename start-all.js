const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting WhatsApp Bridge Microservice on port 3001...');
const bridge = spawn('node', [path.join(__dirname, 'whatsapp-bridge.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001', WHATSAPP_PORT: '3001' }
});

bridge.on('error', (err) => {
  console.error('Failed to start WhatsApp Bridge:', err);
});

console.log('🚀 Starting Next.js Web Server...');
const nextApp = spawn('npx', ['next', 'start'], {
  stdio: 'inherit',
  env: process.env
});

nextApp.on('exit', (code) => {
  process.exit(code || 0);
});
