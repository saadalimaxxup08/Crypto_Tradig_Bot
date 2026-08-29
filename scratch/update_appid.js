const fs = require('fs');
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
  
  const newAppId = '34eMOqShuCNvd5v0qOP5F';
  
  supabase.from('settings').update({ deriv_app_id: newAppId }).eq('id', 1).then(({ error }) => {
    if (error) {
      console.error('🔴 Error updating App ID:', error.message);
    } else {
      console.log('🟢 App ID successfully updated to:', newAppId);
    }
  });
} catch (err) {
  console.error('Error:', err.message);
}
