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
    const overrides = settings.pair_overrides || {};
    const tradingMode = overrides.deriv_trading_mode || settings.deriv_trading_mode || 'DEMO';
    const demoAccount = settings.deriv_demo_account || '';
    const realAccount = settings.deriv_real_account || '';
    const activeAccount = tradingMode === 'DEMO' ? demoAccount : realAccount;

    const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${activeAccount}/otp`;
    console.log('Fetching OTP for original App ID...');
    
    try {
      const response = await fetch(otpUrl, {
        method: 'POST',
        headers: {
          'Deriv-App-ID': appId,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const otpData = await response.json();
      if (!otpData.data || !otpData.data.url) {
        console.error('Failed to generate OTP:', otpData);
        return;
      }
      
      const wsUrl = otpData.data.url;
      console.log('OTP URL:', wsUrl);

      console.log('Connecting to WebSocket spoofing Vercel origin...');
      const ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        origin: 'https://crypto08-tradig-bot.vercel.app' // Spoof the registered Vercel domain!
      });
      
      ws.onopen = () => {
        console.log('🟢 Success! Connected by spoofing Vercel origin.');
        ws.send(JSON.stringify({ ping: 1 }));
      };
      
      ws.onmessage = (event) => {
        console.log('🟢 Message received:', event.data);
        ws.close();
      };
      
      ws.onerror = (e) => {
        console.error('🔴 Error:', e.message || e);
      };
      
      ws.onclose = () => {
        console.log('Connection closed.');
      };

    } catch (fetchErr) {
      console.error('Fetch Error:', fetchErr.message);
    }
  });
} catch (err) {
  console.error('Error:', err.message);
}
