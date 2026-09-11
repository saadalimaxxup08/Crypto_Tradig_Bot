const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStepProgressionTrace() {
  console.log("Fetching Martingale trades from DB...");
  const { data: trades, error } = await supabase
    .from('deriv_trades')
    .select('*')
    .neq('stake', 1.00)
    .order('created_at', { ascending: true });

  if (error || !trades) {
    console.error("DB Error:", error);
    return;
  }

  console.log(`Total Martingale trades found: ${trades.length}\n`);

  trades.forEach((t, i) => {
    const jeddahTime = new Date(t.created_at).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
    console.log(`[#${i + 1}] Time: ${jeddahTime} | Symbol: ${t.symbol} | Stake: $${t.stake} | Status: ${t.status} | PnL: ${t.pnl}`);
  });
}

checkStepProgressionTrace();
