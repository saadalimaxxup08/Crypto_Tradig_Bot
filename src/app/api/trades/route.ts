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
    // 1. Fetch up to 5000 trades using pagination to bypass Supabase 1000 limit
    let allTrades: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore && allTrades.length < 5000) {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        allTrades = [...allTrades, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const trades = allTrades;

    const openTrades = trades?.filter((t) => t.status === 'OPEN') || [];
    const livePrices: Record<string, number> = {};

    // 2. Fetch live prices from Binance server-side as a reliable fallback
    if (openTrades.length > 0) {
      try {
        const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (settings) {
          const isDemo = settings.trading_mode === 'DEMO';
          const demoKey = settings.binance_demo_api_key || settings.binance_api_key || '';
          const demoSecret = settings.binance_demo_secret_key || settings.binance_secret_key || '';
          const realKey = settings.binance_real_api_key || '';
          const realSecret = settings.binance_real_secret_key || '';

          const apiKey = isDemo ? demoKey : realKey;
          const secretKey = isDemo ? demoSecret : realSecret;

          if (apiKey && secretKey) {
            const exchange = getBinanceClient(apiKey, secretKey, isDemo);
            const pairs = Array.from(new Set(openTrades.map((t) => t.pair)));
            
            // Format to CCXT futures symbol e.g., XRP/USDT:USDT
            const ccxtSymbols = pairs.map(p => {
              if (p.endsWith('USDT')) {
                return `${p.slice(0, -4)}/USDT:USDT`;
              }
              return p;
            });

            const tickers = await exchange.fetchTickers(ccxtSymbols);
            pairs.forEach(p => {
              const ccxtSym = p.endsWith('USDT') ? `${p.slice(0, -4)}/USDT:USDT` : p;
              const ticker = tickers[ccxtSym];
              if (ticker && ticker.last !== undefined) {
                livePrices[p] = ticker.last;
              }
            });
          }
        }
      } catch (err: any) {
        console.error('Server-side price fallback fetch failed:', err.message);
      }
    }

    return NextResponse.json({ success: true, trades: trades || [], livePrices });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
