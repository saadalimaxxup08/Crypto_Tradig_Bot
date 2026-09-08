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

  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Settings configuration not found.' }, { status: 400 });
    }

    const telegramToken = settings.telegram_token || '';
    const telegramChatId = settings.telegram_chat_id || '';

    if (telegramToken && telegramChatId) {
      await sendTelegramMessage(
        telegramToken,
        telegramChatId,
        `🧪 <b>DERIV TEST TRADE DIAGNOSTIC</b>\nDeriv trading engine test trigger received successfully!`
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Deriv test diagnostic executed cleanly.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
