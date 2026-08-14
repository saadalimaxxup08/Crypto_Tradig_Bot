import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (!settings) {
    console.error('Settings not found.');
    return;
  }

  console.log('--- SCANNER DETAILS ---');
  console.log('Bot Enabled:', settings.bot_enabled);
  console.log('Trading Mode:', settings.trading_mode);
  
  console.log('\n--- SCANNER LOGS ---');
  if (settings.last_scan_logs) {
    settings.last_scan_logs.forEach((log: string) => console.log(log));
  } else {
    console.log('No logs found.');
  }

  // Fetch recent trades to see if any POL trade was attempted or failed
  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5);

  console.log('\n--- RECENT TRADES IN DB ---');
  trades?.forEach(t => {
    console.log(`- Trade: ${t.pair} (${t.direction}), Status: ${t.status}, Time: ${t.timestamp}, P&L: ${t.pnl}`);
  });
}

check();
