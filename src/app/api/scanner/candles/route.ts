import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient } from '@/lib/binance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('pairs, binance_api_key, binance_secret_key')
      .eq('id', 1)
      .single();

    const pairs = settings?.pairs || [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'TONUSDT', 'SHIBUSDT', 'TRXUSDT',
      'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'LINKUSDT',
      'ATOMUSDT', 'XLMUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT'
    ];

    const apiKey = settings?.binance_api_key || process.env.BINANCE_API_KEY || '';
    const secretKey = settings?.binance_secret_key || process.env.BINANCE_SECRET_KEY || '';

    // If no credentials, we can fetch public data using ccxt's public client
    const exchange = getBinanceClient(
      apiKey || 'test',
      secretKey || 'test'
    );

    // Fetch last 30 candles for all pairs concurrently
    const candlesData: { [symbol: string]: number[] } = {};

    await Promise.all(
      pairs.map(async (pair: string) => {
        try {
          const ohlcv = await exchange.fetchOHLCV(pair, '1m', undefined, 35);
          candlesData[pair] = ohlcv.map((c: any) => c[4]); // close prices
        } catch (err) {
          console.error(`Failed to fetch candles for ${pair}:`, err);
          candlesData[pair] = [];
        }
      })
    );

    return NextResponse.json({ success: true, candles: candlesData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
