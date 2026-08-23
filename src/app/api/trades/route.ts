import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient } from '@/lib/binance';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetStrategy = searchParams.get('strategy') || '';

  try {
    let detailedTrades: any[] = [];

    if (targetStrategy) {
      // 1. Fetch detailed trades for the target strategy (up to 5000 rows paginated)
      let dPage = 0;
      const dPageSize = 1000;
      let dHasMore = true;

      while (dHasMore && detailedTrades.length < 5000) {
        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('strategy', targetStrategy)
          .order('timestamp', { ascending: false })
          .range(dPage * dPageSize, (dPage + 1) * dPageSize - 1);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (data && data.length > 0) {
          detailedTrades = [...detailedTrades, ...data];
          if (data.length < dPageSize) {
            dHasMore = false;
          } else {
            dPage++;
          }
        } else {
          dHasMore = false;
        }
      }
    } else {
      // Default behavior: fetch top 1000 trades across all strategies
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      detailedTrades = data || [];
    }

    // 2. Fetch light records of ALL trades in the database for the leaderboard (up to 30,000 rows paginated)
    let allRawTrades: any[] = [];
    let rPage = 0;
    const rPageSize = 1000;
    let rHasMore = true;

    while (rHasMore && allRawTrades.length < 30000) {
      const { data, error } = await supabase
        .from('trades')
        .select('strategy, pnl, status, is_paper, closed_at')
        .order('timestamp', { ascending: false })
        .range(rPage * rPageSize, (rPage + 1) * rPageSize - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        allRawTrades = [...allRawTrades, ...data];
        if (data.length < rPageSize) {
          rHasMore = false;
        } else {
          rPage++;
        }
      } else {
        rHasMore = false;
      }
    }

    // 3. Fetch all open trades in the database (across all strategies)
    const { data: dbOpenTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'OPEN');
      
    const openTrades = dbOpenTrades || [];
    const livePrices: Record<string, number> = {};

    // 4. Fetch live prices and actual Binance positions
    let binancePositions: any[] = [];
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
          
          // Fetch positions
          const allPositions = await exchange.fetchPositions();
          binancePositions = allPositions
            .filter((p: any) => Math.abs(parseFloat(p.contracts || p.positionAmt || 0)) > 0)
            .map((p: any) => ({
              symbol: p.symbol,
              pair: p.symbol.includes('/') ? p.symbol.split('/')[0] + 'USDT' : p.symbol,
              contracts: Math.abs(parseFloat(p.contracts || p.positionAmt || 0)),
              side: parseFloat(p.contracts || p.positionAmt || 0) > 0 ? 'LONG' : 'SHORT',
              entryPrice: parseFloat(p.entryPrice || 0),
              markPrice: parseFloat(p.markPrice || 0),
              unrealizedPnl: parseFloat(p.unrealizedPnl || 0),
              leverage: parseInt(p.leverage || 20)
            }));

          // Fetch prices for fallback
          if (openTrades.length > 0) {
            const pairs = Array.from(new Set(openTrades.map((t) => t.pair)));
            const ccxtSymbols = pairs.map(p => p.endsWith('USDT') ? `${p.slice(0, -4)}/USDT:USDT` : p);
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
      }
    } catch (err: any) {
      console.error('Binance API fetch failed inside trades endpoint:', err.message);
    }

    return NextResponse.json({ 
      success: true, 
      trades: detailedTrades,
      detailedTrades, 
      allRawTrades, 
      openTrades,
      livePrices,
      binancePositions
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
