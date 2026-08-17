const fs = require('fs');
const path = require('path');
const http = require('http');

async function diagnose() {
  console.log('--- WHATSAPP BRIDGE DIAGNOSTICS ---');
  
  // 1. Check local session folder
  const authFolder = path.join(__dirname, 'auth_info_baileys');
  console.log('Session Folder path:', authFolder);
  console.log('Session Folder exists:', fs.existsSync(authFolder));
  if (fs.existsSync(authFolder)) {
    const files = fs.readdirSync(authFolder);
    console.log('Files in session folder:', files);
  }

  // 2. Check config file
  const configPath = path.join(__dirname, 'whatsapp_config.json');
  console.log('Config File exists:', fs.existsSync(configPath));
  if (fs.existsSync(configPath)) {
    console.log('Config File content:', fs.readFileSync(configPath, 'utf-8'));
  }

  // 3. Try to request port 3001
  console.log('Pinging http://localhost:3001/status...');
  const req = http.get('http://localhost:3001/status', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      console.log('Response body:', data);
    });
  });

  req.on('error', (err) => {
    console.error('Ping failed:', err.message);
  });
}

diagnose();
