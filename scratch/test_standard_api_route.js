const fs = require('fs');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  });

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  supabase.from('settings').select('*').single().then(async ({ data: settings, error }) => {
    if (error) {
      console.error('Database query error:', error.message);
      return;
    }

    const appId = '34eMOqShuCNvd5v0qOP5F'; // Original App ID
    const token = settings.deriv_api_token || '';

    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
    console.log('Connecting to standard WebSocket directly:', wsUrl);

    let socket = null;
    try {
      socket = await new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          origin: 'https://crypto08-tradig-bot.vercel.app'
        });

        ws.on('unexpected-response', (req, res) => {
          reject(new Error(`Handshake rejected: HTTP ${res.statusCode}`));
        });

        ws.on('open', () => {
          console.log('Handshake ok, sending authorize payload...');
          const handleAuth = (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.msg_type === 'authorize') {
                ws.off('message', handleAuth);
                if (msg.error) {
                  reject(new Error(`Authorization failed: ${msg.error.message}`));
                } else {
                  console.log('Authorization success!');
                  resolve(ws);
                }
              }
            } catch (err) {
              reject(new Error(`Auth parse error: ${err.message}`));
            }
          };
          ws.on('message', handleAuth);
          ws.send(JSON.stringify({ authorize: token }));
        });

        ws.on('error', (e) => reject(new Error(e.message || 'WebSocket handshake failed.')));
        setTimeout(() => reject(new Error('Connection timed out.')), 15000);
      });

      console.log('🟢 Success! Connection and Authorization completed.');
      socket.close();
    } catch (wsErr) {
      console.error('🔴 Connection failed:', wsErr.message);
    }
  });
} catch (err) {
  console.error('Error:', err.message);
}
