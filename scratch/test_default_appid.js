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

    // Use default public App ID 1089!
    const appId = '1089';
    const token = settings.deriv_api_token || '';
    const overrides = settings.pair_overrides || {};
    const tradingMode = overrides.deriv_trading_mode || settings.deriv_trading_mode || 'DEMO';
    const demoAccount = settings.deriv_demo_account || '';
    const realAccount = settings.deriv_real_account || '';
    const activeAccount = tradingMode === 'DEMO' ? demoAccount : realAccount;

    const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${activeAccount}/otp`;
    console.log('Fetching OTP using public App ID 1089...');
    
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

      console.log('Connecting to WebSocket using public App ID 1089...');
      const ws = new WebSocket(wsUrl); // No custom origin header needed!
      
      ws.onopen = () => {
        console.log('🟢 Success! Connected to Deriv using App ID 1089.');
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
