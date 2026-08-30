import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file received' }, { status: 400 });
    }

    // 1. Fetch settings to get telegram credentials
    const { data: settings } = await supabase
      .from('settings')
      .select('telegram_token, telegram_chat_id')
      .eq('id', 1)
      .single();

    const telegramToken = settings?.telegram_token || process.env.TELEGRAM_TOKEN || '';
    const telegramChatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';

    if (!telegramToken || !telegramChatId) {
      return NextResponse.json({ error: 'Telegram credentials not configured in settings!' }, { status: 400 });
    }

    // 2. Prepare payload to send to Telegram sendDocument API
    const telegramFormData = new FormData();
    telegramFormData.append('chat_id', telegramChatId);
    telegramFormData.append('caption', `📊 <b>Deriv Options Performance PDF Report</b>\nPeriod: ${startDate} to ${endDate}`);
    telegramFormData.append('parse_mode', 'HTML');
    telegramFormData.append('document', file);

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendDocument`,
      {
        method: 'POST',
        body: telegramFormData,
      }
    );

    const telegramData = await telegramRes.json();
    if (!telegramRes.ok || !telegramData.ok) {
      return NextResponse.json(
        { error: telegramData.description || 'Failed to send file to Telegram' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'PDF report sent to Telegram successfully!' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
