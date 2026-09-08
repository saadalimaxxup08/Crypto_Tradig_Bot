import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function maskString(str: string): string {
  if (!str) return '';
  if (str.length <= 8) return '********';
  return str.slice(0, 4) + '...' + str.slice(-4);
}

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const defaultSettings = {
      id: 1,
      bot_enabled: false,
      telegram_token: '',
      telegram_chat_id: '',
    };

    const finalSettings = settings || defaultSettings;

    return NextResponse.json({
      ...finalSettings,
      telegram_token: maskString(finalSettings.telegram_token || ''),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    const updateData: any = {};
    
    const fields = [
      'bot_enabled',
      'telegram_chat_id',
      'pair_overrides',
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.telegram_token && !body.telegram_token.includes('...')) {
      updateData.telegram_token = body.telegram_token;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('settings')
      .upsert({ id: 1, ...updateData })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
