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

async function checkTrades() {
  const { data: trades, error } = await supabase
    .from('deriv_trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching trades:', error);
    return;
  }

  console.log('=== LATEST 10 TRADES IN DB ===');
  trades.forEach(t => {
    console.log(`ID: ${t.contract_id} | Pair: ${t.symbol} | Type: ${t.contract_type} | Status: ${t.status} | PnL: ${t.pnl} | Created: ${t.created_at}`);
  });

  const { data: openTrades } = await supabase
    .from('deriv_trades')
    .select('*')
    .eq('status', 'OPEN');

  console.log(`\n=== CURRENT OPEN TRADES (${openTrades?.length || 0}) ===`);
  (openTrades || []).forEach(t => {
    console.log(`Open ID: ${t.contract_id} | Pair: ${t.symbol} | Created: ${t.created_at}`);
  });

  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const overrides = settings?.pair_overrides || {};
  console.log('\n=== LAST SCAN INFO ===');
  console.log('Last Scan At:', overrides.deriv_last_scan_at);
  console.log('Last Scan Logs (last 10):');
  (overrides.deriv_last_scan_logs || []).slice(-10).forEach(l => console.log('  ', l));
}

checkTrades();
