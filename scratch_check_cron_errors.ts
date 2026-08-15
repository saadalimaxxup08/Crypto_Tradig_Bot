import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: settings } = await supabase.from('settings').select('last_scan_logs').eq('id', 1).single();
  console.log('=== FULL LAST SCAN LOGS ===');
  if (settings?.last_scan_logs) {
    settings.last_scan_logs.forEach((log: string) => console.log(log));
  } else {
    console.log('No logs found.');
  }
}

check();
