const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
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
  supabase.from('settings').select('*').single().then(({ data, error }) => {
    if (error) {
      console.error('Database query error:', error.message);
      return;
    }
    console.log('--- SCANNER VERIFICATION RESULTS ---');
    console.log('BOT ENABLED:', data.pair_overrides.deriv_bot_enabled);
    console.log('ACTIVE TRADING MODE:', data.pair_overrides.deriv_trading_mode || 'DEMO');
    console.log('LAST SCAN HEARTBEAT:', data.pair_overrides.deriv_last_scan_at);
    console.log('CURRENT TIME ON SERVER:', new Date().toISOString());
    console.log('SELECTED PAIRS TO SCAN:', data.pair_overrides.deriv_selected_pairs);
    console.log('\n--- LATEST SCANS HEARTBEAT LOGS ---');
    if (data.pair_overrides.deriv_last_scan_logs) {
      data.pair_overrides.deriv_last_scan_logs.forEach(l => console.log('  ', l));
    } else {
      console.log('No logs found.');
    }
  });
} catch (err) {
  console.error('Error reading env file:', err.message);
}
