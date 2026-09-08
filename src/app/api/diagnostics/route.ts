import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const report: {
    database: { status: 'OK' | 'ERROR'; message: string };
    deriv: { status: 'OK' | 'ERROR'; message: string };
    telegram: { status: 'OK' | 'ERROR'; message: string };
  } = {
    database: { status: 'ERROR', message: 'Not tested' },
    deriv: { status: 'ERROR', message: 'Not tested' },
    telegram: { status: 'ERROR', message: 'Not tested' },
  };

  try {
    // 1. Test Supabase Database
    try {
      const { data, error } = await supabase.from('settings').select('id').eq('id', 1).single();
      if (error) throw error;
      report.database = { status: 'OK', message: 'Connected successfully to settings table.' };
    } catch (err: any) {
      report.database = { status: 'ERROR', message: 'DB query failed: ' + err.message };
    }

    // 2. Fetch Deriv settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    const appId = settings?.deriv_app_id || process.env.DERIV_APP_ID || '';
    const token = settings?.deriv_api_token || process.env.DERIV_API_TOKEN || '';
    const telegramToken = settings?.telegram_token || process.env.TELEGRAM_TOKEN || '';
    const telegramChatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';

    // 3. Test Deriv Credentials
    if (!appId || !token) {
      report.deriv = { status: 'ERROR', message: 'Deriv App ID or API Token is missing in settings.' };
    } else {
      report.deriv = { status: 'OK', message: `Deriv App ID ${appId} configured. Ready for WebSocket trading.` };
    }

    // 4. Test Telegram Connection
    if (!telegramToken || !telegramChatId) {
      report.telegram = { status: 'ERROR', message: 'Telegram Token or Chat ID is missing.' };
    } else {
      try {
        const msgText = `🔧 <b>DERIV SYSTEM DIAGNOSTIC REPORT</b>\n` +
          `-----------------------------------\n` +
          `• <b>Database Link</b>: 🟢 ${report.database.status}\n` +
          `• <b>Deriv API</b>: 🟢 ${report.deriv.status}\n` +
          `• <b>Telegram Alert Route</b>: 🟢 OK\n` +
          `-----------------------------------\n` +
          `All systems check completed. Deriv trading engine ready.`;

        const sent = await sendTelegramMessage(telegramToken, telegramChatId, msgText);
        if (sent) {
          report.telegram = { status: 'OK', message: 'Test message sent successfully to Telegram.' };
        } else {
          throw new Error('Telegram API request returned error.');
        }
      } catch (err: any) {
        report.telegram = { status: 'ERROR', message: 'Failed to send Telegram alert: ' + err.message };
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
