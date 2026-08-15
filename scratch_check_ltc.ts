import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: openLtc } = await supabase
    .from('trades')
    .select('*')
    .eq('pair', 'LTCUSDT')
    .eq('status', 'OPEN');

  console.log('=== LTC OPEN TRADES IN DATABASE ===');
  if (!openLtc || openLtc.length === 0) {
    console.log('No open LTC trades found in database.');
  } else {
    openLtc.forEach(t => {
      console.log(`- ID: ${t.id}`);
      console.log(`  Pair: ${t.pair}`);
      console.log(`  Direction: ${t.direction}`);
      console.log(`  Status: ${t.status}`);
      console.log(`  Time: ${t.timestamp}`);
    });
  }

  // Get last scan logs to see if LTC was processed or skipped
  const { data: settings } = await supabase.from('settings').select('last_scan_logs').eq('id', 1).single();
  console.log('\n=== LAST SCAN LOGS PREVIEW ===');
  if (settings?.last_scan_logs) {
    // Print logs that mention LTC
    const ltcLogs = settings.last_scan_logs.filter((log: string) => log.includes('LTC') || log.includes('execute'));
    if (ltcLogs.length === 0) {
      console.log('No specific LTC logs found. Last 5 general logs:');
      console.log(settings.last_scan_logs.slice(-5).join('\n'));
    } else {
      ltcLogs.forEach((log: string) => console.log(log));
    }
  }
}

check();
