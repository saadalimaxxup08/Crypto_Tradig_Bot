import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient, fetchFuturesBalance } from '@/lib/binance';

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
      max_open_trades: 10,
      active_strategy: 'RSI_MACD',
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
      'max_open_trades',
      'trading_mode',
      'pairs',
      'telegram_chat_id',
      'pair_overrides',
      'active_strategy',
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

    // Fetch existing settings to use as fallbacks for verification
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    // Verify new Binance API keys if they are submitted/changed
    const isModeDemo = (body.trading_mode || settings?.trading_mode || 'DEMO') === 'DEMO';
    const isNewDemoKey = body.binance_demo_api_key && !body.binance_demo_api_key.includes('...');
    const isNewDemoSecret = body.binance_demo_secret_key && !body.binance_demo_secret_key.includes('...');
    const isNewRealKey = body.binance_real_api_key && !body.binance_real_api_key.includes('...');
    const isNewRealSecret = body.binance_real_secret_key && !body.binance_real_secret_key.includes('...');

    // If Demo Mode is active and Demo keys are changing, test connection
    if ((isNewDemoKey || isNewDemoSecret) && isModeDemo) {
      const testKey = isNewDemoKey ? body.binance_demo_api_key : (settings?.binance_demo_api_key || '');
      const testSecret = isNewDemoSecret ? body.binance_demo_secret_key : (settings?.binance_demo_secret_key || '');

      if (testKey && testSecret) {
        try {
          const exchange = getBinanceClient(testKey, testSecret, true);
          await fetchFuturesBalance(exchange);
        } catch (err: any) {
          return NextResponse.json({
            error: `Binance Demo API Key validation failed: ${err.message}. Please check your keys.`
          }, { status: 400 });
        }
      }
    }

    // If Real Mode is active and Real keys are changing, test connection
    if ((isNewRealKey || isNewRealSecret) && !isModeDemo) {
      const testKey = isNewRealKey ? body.binance_real_api_key : (settings?.binance_real_api_key || '');
      const testSecret = isNewRealSecret ? body.binance_real_secret_key : (settings?.binance_real_secret_key || '');

      if (testKey && testSecret) {
        try {
          const exchange = getBinanceClient(testKey, testSecret, false);
          await fetchFuturesBalance(exchange);
        } catch (err: any) {
          return NextResponse.json({
            error: `Binance Live API Key validation failed: ${err.message}. Make sure your API key has "Enable Futures" active on Binance.`
          }, { status: 400 });
        }
      }
    }

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
