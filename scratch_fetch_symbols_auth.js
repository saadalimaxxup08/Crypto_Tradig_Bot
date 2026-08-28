const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Custom env loader for .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length > 1) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchOTP(appId, token, accountId) {
  const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`;
  const response = await fetch(otpUrl, {
    method: 'POST',
    headers: {
      'Deriv-App-ID': appId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (response.status !== 200) {
    throw new Error(`Failed to generate OTP: ${await response.text()}`);
  }
  const otpData = await response.json();
  return otpData.data.url;
}

async function main() {
  console.log('Fetching credentials from Supabase settings table...');
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  
  const appId = settings?.deriv_app_id;
  const token = settings?.deriv_api_token;
  const accountId = settings?.deriv_demo_account || settings?.deriv_real_account;

  if (!appId || !token || !accountId) {
    console.error('Error: Credentials missing in database. Please configure settings first.');
    return;
  }

  console.log(`Generating OTP URL for App ID: ${appId}...`);
  const wsUrl = await fetchOTP(appId, token, accountId);

  console.log('Connecting to Deriv WebSocket via OTP URL...');
  const ws = new global.WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected! Requesting active symbolsbrief...');
    ws.send(JSON.stringify({
      active_symbols: 'brief'
    }));
  };

  ws.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);
      if (response.msg_type === 'active_symbols') {
        const symbols = response.active_symbols || [];
        console.log(`Successfully fetched ${symbols.length} active symbols!`);
        if (symbols.length > 0) {
          console.log('Sample symbol item structure:', JSON.stringify(symbols[0], null, 2));
        }
        // Let's filter and group by market
        const markets = {};
        symbols.forEach(s => {
          // Format market name nicely
          let market = s.market || 'Other Markets';
          if (market === 'synthetic_index') market = 'Synthetic Indices (Volatility, Crash, Boom)';
          else if (market === 'forex') market = 'Forex Currency Pairs';
          else if (market === 'commodities') market = 'Commodities & Metals (Gold/Silver)';
          else if (market === 'cryptocurrency') market = 'Cryptocurrencies';
          else if (market === 'indices') market = 'Stock Market Indices';

          let submarket = s.submarket || 'Other submarket';
          if (submarket === 'random_index') submarket = 'Volatility Volatility Indices';
          else if (submarket === 'crash_boom') submarket = 'Crash / Boom Indices';
          else if (submarket === 'major_pairs') submarket = 'Major Currency Pairs';
          else if (submarket === 'minor_pairs') submarket = 'Minor Currency Pairs';

          if (!markets[market]) {
            markets[market] = [];
          }
          markets[market].push({
            symbol: s.underlying_symbol || '',
            name: s.underlying_symbol_name || s.underlying_symbol || '',
            submarket: submarket
          });
        });

        console.log('\n======================================================');
        console.log('        AVAILABLE DERIV SYMBOLS BY MARKET CATEGORY');
        console.log('======================================================\n');

        for (const [market, list] of Object.entries(markets)) {
          console.log(`\n📂 MARKET: ${market} (${list.length} assets)`);
          console.log('--------------------------------------------------');
          
          // Group by submarket
          const submarkets = {};
          list.forEach(item => {
            if (!submarkets[item.submarket]) {
              submarkets[item.submarket] = [];
            }
            submarkets[item.submarket].push(`${item.name} (${item.symbol})`);
          });

          for (const [submarket, items] of Object.entries(submarkets)) {
            console.log(`  🔹 ${submarket}:`);
            const visible = items;
            visible.forEach(it => console.log(`     • ${it}`));
          }
        }

        console.log('\n======================================================');
        ws.close();
      }
    } catch (e) {
      console.error('Error parsing msg:', e);
      ws.close();
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket Error:', err);
  };

  ws.onclose = () => {
    console.log('Connection closed.');
  };
}

main().catch(err => console.error('Error:', err));
