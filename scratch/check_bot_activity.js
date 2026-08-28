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
  supabase.from('settings').select('*').single().then(async ({ data: settings, error }) => {
    if (error) {
      console.error('Database query error:', error.message);
      return;
    }
    
    const overrides = settings.pair_overrides || {};
    
    console.log('=============================================');
    console.log('🔍 SYSTEM AUDIT: OFFLINE RUNNING BOTS STATUS');
    console.log('=============================================');
    
    // 1. BINANCE BOT STATUS
    console.log('\n🔸 1. BINANCE SPOT BOT (Crypto)');
    console.log('---------------------------------');
    console.log('Bot Status:', settings.bot_enabled ? '🟢 RUNNING' : '🔴 PAUSED');
    console.log('Last Scan Heartbeat:', overrides.last_scan_at || 'Never');
    console.log('Latest Logs Snippet:');
    if (overrides.last_scan_logs) {
      overrides.last_scan_logs.slice(-5).forEach(l => console.log('  ->', l));
    } else {
      console.log('  -> No logs found.');
    }
    
    // 2. DERIV OPTIONS BOT STATUS
    console.log('\n🔸 2. DERIV ACTIVE OPTIONS BOT');
    console.log('---------------------------------');
    console.log('Bot Status:', overrides.deriv_bot_enabled ? '🟢 RUNNING' : '🔴 PAUSED');
    console.log('Last Scan Heartbeat:', overrides.deriv_last_scan_at || 'Never');
    console.log('Latest Logs Snippet:');
    if (overrides.deriv_last_scan_logs) {
      overrides.deriv_last_scan_logs.slice(-5).forEach(l => console.log('  ->', l));
    } else {
      console.log('  -> No logs found.');
    }
    
    // Fetch last closed trades count for both
    const { count: binanceCount } = await supabase.from('trades').select('*', { count: 'exact', head: true });
    const { count: derivCount } = await supabase.from('deriv_trades').select('*', { count: 'exact', head: true });
    
    console.log('\n=============================================');
    console.log('📊 TOTAL TRADES HISTORICALLY RECORDED');
    console.log('=============================================');
    console.log('Binance Trades Count:', binanceCount || 0);
    console.log('Deriv Options Count :', derivCount || 0);
  });
} catch (err) {
  console.error('Error reading env file:', err.message);
}
