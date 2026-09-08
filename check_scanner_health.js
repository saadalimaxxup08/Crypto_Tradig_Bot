const fs = require('fs');
const { createClient } = require('./node_modules/@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf8');

const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkHealth() {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  console.log('=== BOT SETTINGS STATUS ===');
  console.log('Bot Enabled:', settings.deriv_bot_enabled);
  console.log('App ID:', settings.deriv_app_id);
  console.log('Demo Account:', settings.deriv_demo_account);
  
  const overrides = settings.pair_overrides || {};
  console.log('Last Scan At:', overrides.deriv_last_scan_at);
  console.log('Active Strategies:', overrides.deriv_active_strategies);
  console.log('Selected Pairs Count:', (overrides.deriv_selected_pairs || []).length);
  console.log('Selected Pairs:', overrides.deriv_selected_pairs);
  console.log('Recent Scan Logs (last 10):');
  (overrides.deriv_last_scan_logs || []).slice(-10).forEach(l => console.log('  ', l));

  // Check recent trades
  const { data: trades } = await supabase
    .from('deriv_trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n=== RECENT TRADES (Last 5) ===');
  trades.forEach(t => {
    console.log(`${t.contract_id} | ${t.symbol} | ${t.contract_type} | ${t.status} | pnl: ${t.pnl} | created: ${t.created_at}`);
  });
}

checkHealth();
