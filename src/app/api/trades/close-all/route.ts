import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient, cancelAllOpenOrders } from '@/lib/binance';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch settings to get API credentials and mode
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    const isDemo = settings.trading_mode === 'DEMO';
    const demoKey = settings.binance_demo_api_key || settings.binance_api_key || '';
    const demoSecret = settings.binance_demo_secret_key || settings.binance_secret_key || '';
    const realKey = settings.binance_real_api_key || '';
    const realSecret = settings.binance_real_secret_key || '';

    const apiKey = isDemo ? demoKey : realKey;
    const secretKey = isDemo ? demoSecret : realSecret;

    const logs: string[] = [];

    // 2. If API keys are set, close live positions on Binance USD-M Futures
    if (apiKey && secretKey) {
      try {
        const exchange = getBinanceClient(apiKey, secretKey, isDemo);
        
        // Fetch all open positions on Binance USD-M Futures
        const positions = await exchange.fetchPositions();
        const activePositions = positions.filter((p: any) => 
          Math.abs(parseFloat((p as any).contracts || (p as any).positionAmt || 0)) > 0
        );

        logs.push(`Found ${activePositions.length} active positions on Binance USD-M Futures.`);

        for (const p of activePositions) {
          const symbol = (p as any).symbol as any; // e.g. "BTC/USDT:USDT"
          const amount = Math.abs(parseFloat((p as any).contracts || (p as any).positionAmt || 0));
          const side = parseFloat((p as any).contracts || (p as any).positionAmt || 0) > 0 ? 'sell' : 'buy';

          try {
            // Place closing Market Order
            logs.push(`Closing position for ${symbol}: placing ${side} market order for size ${amount}`);
            await exchange.createMarketOrder(symbol, side, amount, undefined, { reduceOnly: true });
            
            // Cancel all open orders for this symbol
            await cancelAllOpenOrders(exchange, symbol);
            logs.push(`Successfully closed position and cancelled open orders for ${symbol}.`);
          } catch (posCloseErr: any) {
            logs.push(`Error closing position for ${symbol}: ${posCloseErr.message}`);
          }
        }
      } catch (binanceErr: any) {
        logs.push(`Binance connection/execution error: ${binanceErr.message}`);
      }
    } else {
      logs.push('No Binance API credentials configured. Skipping live positions close.');
    }

    // 3. Fetch all OPEN database trades and update them to CLOSED
    const { data: dbOpenTrades, error: dbFetchErr } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'OPEN');

    if (dbFetchErr) {
      return NextResponse.json({ error: `Database fetch error: ${dbFetchErr.message}` }, { status: 500 });
    }

    logs.push(`Found ${dbOpenTrades?.length || 0} open trades in database.`);

    if (dbOpenTrades && dbOpenTrades.length > 0) {
      for (const trade of dbOpenTrades) {
        let exitPrice = trade.entry_price; // fallback
        
        // Try to fetch current mark price from Binance
        if (apiKey && secretKey) {
          try {
            const exchange = getBinanceClient(apiKey, secretKey, isDemo);
            const ccxtSym = trade.pair.endsWith('USDT') ? `${trade.pair.slice(0, -4)}/USDT:USDT` : trade.pair;
            const ticker = await exchange.fetchTicker(ccxtSym);
            if (ticker && ticker.last !== undefined) {
              exitPrice = ticker.last;
            }
          } catch (pErr) {
            console.error(`Failed to fetch current price for ${trade.pair}:`, pErr);
          }
        }

        const grossPnl = (exitPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);
        const entryFee = trade.entry_price * trade.amount * 0.0005;
        const exitFee = exitPrice * trade.amount * 0.0005;
        const realizedPnl = grossPnl - (entryFee + exitFee);

        await supabase
          .from('trades')
          .update({
            status: 'CLOSED',
            exit_price: exitPrice,
            pnl: realizedPnl,
            closed_at: new Date().toISOString(),
          })
          .eq('id', trade.id);
      }
      logs.push(`Successfully updated all ${dbOpenTrades.length} database trades to CLOSED.`);
    }

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    console.error('Emergency close all error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
