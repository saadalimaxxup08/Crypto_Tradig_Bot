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
      tp_percent: 2.0,
      sl_percent: 1.0,
      risk_amount: 10.0,
      leverage: 20,
      trading_mode: 'DEMO',
      binance_demo_api_key: '',
      binance_demo_secret_key: '',
      binance_real_api_key: '',
      binance_real_secret_key: '',
      pairs: [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
        'DOGEUSDT', 'ADAUSDT', 'TONUSDT', '1000SHIBUSDT', 'TRXUSDT',
        'AVAXUSDT', 'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'LINKUSDT',
        'ATOMUSDT', 'XLMUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT'
      ],
      telegram_token: '',
      telegram_chat_id: '',
      binance_api_key: '',
      binance_secret_key: ''
    };

    const finalSettings = settings || defaultSettings;

    // Mask sensitive details for frontend
    return NextResponse.json({
      ...finalSettings,
      telegram_token: maskString(finalSettings.telegram_token || ''),
      binance_api_key: maskString(finalSettings.binance_api_key || ''),
      binance_secret_key: maskString(finalSettings.binance_secret_key || ''),
      binance_demo_api_key: maskString(finalSettings.binance_demo_api_key || ''),
      binance_demo_secret_key: maskString(finalSettings.binance_demo_secret_key || ''),
      binance_real_api_key: maskString(finalSettings.binance_real_api_key || ''),
      binance_real_secret_key: maskString(finalSettings.binance_real_secret_key || ''),
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
    
    // Check if the user is updating sensitive fields
    // If they are masked (contain '...'), do not update them in the DB
    const updateData: any = {};
    
    const fields = [
      'bot_enabled',
      'tp_percent',
      'sl_percent',
      'risk_amount',
      'leverage',
      'trading_mode',
      'pairs',
      'telegram_chat_id',
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.telegram_token && !body.telegram_token.includes('...')) {
      updateData.telegram_token = body.telegram_token;
    }
    if (body.binance_api_key && !body.binance_api_key.includes('...')) {
      updateData.binance_api_key = body.binance_api_key;
    }
    if (body.binance_secret_key && !body.binance_secret_key.includes('...')) {
      updateData.binance_secret_key = body.binance_secret_key;
    }
    if (body.binance_demo_api_key && !body.binance_demo_api_key.includes('...')) {
      updateData.binance_demo_api_key = body.binance_demo_api_key;
    }
    if (body.binance_demo_secret_key && !body.binance_demo_secret_key.includes('...')) {
      updateData.binance_demo_secret_key = body.binance_demo_secret_key;
    }
    if (body.binance_real_api_key && !body.binance_real_api_key.includes('...')) {
      updateData.binance_real_api_key = body.binance_real_api_key;
    }
    if (body.binance_real_secret_key && !body.binance_real_secret_key.includes('...')) {
      updateData.binance_real_secret_key = body.binance_real_secret_key;
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
