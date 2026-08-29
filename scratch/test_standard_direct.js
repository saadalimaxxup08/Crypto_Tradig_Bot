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

    const appId = '1089'; // Public App ID
    const token = settings.deriv_api_token || '';

    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
    console.log('Connecting to standard WebSocket directly:', wsUrl);

    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const handleAuth = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.msg_type === 'authorize') {
          ws.removeEventListener('message', handleAuth);
          if (msg.error) {
            console.error('🔴 Authorization Failed:', msg.error.message);
            ws.close();
          } else {
            console.log('🟢 Direct Authorization Successful! Logged in as:', msg.authorize.email);
            // Let's send a ping to verify connection stability
            ws.send(JSON.stringify({ ping: 1 }));
          }
        } else if (msg.msg_type === 'ping') {
          console.log('🟢 Ping response:', msg.ping);
          ws.close();
        }
      } catch (err) {
        console.error('Error parsing message:', err.message);
      }
    };

    ws.onopen = () => {
      console.log('🟢 Handshake OK. Sending authorize payload...');
      ws.addEventListener('message', handleAuth);
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onerror = (e) => {
      console.error('🔴 WebSocket Error:', e.message || e);
    };

    ws.onclose = () => {
      console.log('Connection closed.');
    };

  });
} catch (err) {
  console.error('Error:', err.message);
}
