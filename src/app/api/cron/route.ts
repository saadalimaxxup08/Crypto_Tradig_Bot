import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { analyzeStrategy } from '@/lib/indicators';
import {
  getBinanceClient,
  placeFuturesOrder,
  cancelAllOpenOrders,
  fetchCurrentPrice,
} from '@/lib/binance';
import { sendTelegramMessage } from '@/lib/telegram';

// Disable caching for Next.js API route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleCron();
}

export async function POST(request: Request) {
  return handleCron();
}

async function handleCron() {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    logs.push('Cron started at ' + new Date().toISOString());

    // 1. Fetch settings from Supabase
    let { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (settingsError || !settings) {
      logs.push('Settings not found in Supabase. Creating default row...');
      const defaultSettings = {
        id: 1,
        bot_enabled: false,
        tp_percent: 2.0,
        sl_percent: 1.0,
        risk_amount: 10.0,
        pairs: [
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
          'DOGEUSDT', 'ADAUSDT', 'TONUSDT', '1000SHIBUSDT', 'TRXUSDT',
          'AVAXUSDT', 'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'LINKUSDT',
          'ATOMUSDT', 'XLMUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT'
        ],
        telegram_token: process.env.TELEGRAM_TOKEN || '',
        telegram_chat_id: process.env.TELEGRAM_CHAT_ID || '',
        binance_api_key: process.env.BINANCE_API_KEY || '',
        binance_secret_key: process.env.BINANCE_SECRET_KEY || ''
      };

      const { data: newSettings, error: insertError } = await supabase
        .from('settings')
        .insert([defaultSettings])
        .select('*')
        .single();

      if (insertError) {
        throw new Error('Failed to create default settings: ' + insertError.message);
      }
      settings = newSettings;
    }

    const {
      bot_enabled,
      tp_percent,
      sl_percent,
      risk_amount,
      pairs,
    } = settings;

    const telegram_token = settings.telegram_token || process.env.TELEGRAM_TOKEN || '';
    const telegram_chat_id = settings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';
    const binance_api_key = settings.binance_api_key || process.env.BINANCE_API_KEY || '';
    const binance_secret_key = settings.binance_secret_key || process.env.BINANCE_SECRET_KEY || '';

    // 2. Manage open positions (Check if TP/SL were hit and close them in DB)
    if (binance_api_key && binance_secret_key) {
      try {
        const exchange = getBinanceClient(binance_api_key, binance_secret_key);
        
        // Fetch all open trades in DB
        const { data: openTrades, error: dbError } = await supabase
          .from('trades')
          .select('*')
          .eq('status', 'OPEN');

        if (dbError) {
          logs.push('DB Error fetching open trades: ' + dbError.message);
        } else if (openTrades && openTrades.length > 0) {
          logs.push(`Found ${openTrades.length} open trades in database. Checking statuses...`);
          
          // Check position statuses on Binance
          for (const trade of openTrades) {
            try {
              // ccxt fetchPositions returns all active positions
              const positions = await exchange.fetchPositions([trade.pair as string]);
              const position = positions.find((p: any) => p.symbol === trade.pair);

              // If position size is 0 or undefined, it has been closed by TP/SL
              const currentSize = position ? parseFloat((position as any).contracts || (position as any).positionAmt || 0) : 0;
              
              if (Math.abs(currentSize) === 0) {
                logs.push(`Position for ${trade.pair} is closed on Binance. Resolving trade details...`);

                // Fetch recent user trades to calculate exact exit price & pnl
                const recentTrades = await exchange.fetchMyTrades(trade.pair as string, undefined, 5);
                // Look for the last trade that was an exit
                const exitSide = trade.direction === 'LONG' ? 'sell' : 'buy';
                const exitTrade = recentTrades
                  .reverse()
                  .find((t: any) => t.side.toLowerCase() === exitSide && parseFloat(t.amount) > 0);

                const exitPrice = exitTrade && exitTrade.price ? (exitTrade.price as number) : (trade.direction === 'LONG' ? trade.tp_price : trade.sl_price);
                const realizedPnl = exitTrade && (exitTrade as any).realizedPnl !== undefined && exitTrade.fee
                  ? Number((exitTrade as any).realizedPnl) - Number(exitTrade.fee.cost || 0)
                  : (exitPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);

                // Cancel any orphaned SL/TP orders on Binance
                await cancelAllOpenOrders(exchange, trade.pair as string);

                // Update database
                const { error: updateErr } = await supabase
                  .from('trades')
                  .update({
                    status: 'CLOSED',
                    exit_price: exitPrice,
                    pnl: realizedPnl,
                    closed_at: new Date().toISOString(),
                  })
                  .eq('id', trade.id);

                if (updateErr) {
                  logs.push(`Error updating trade in DB: ${updateErr.message}`);
                } else {
                  logs.push(`Closed trade ${trade.id} in DB.`);
                  // Send Telegram update
                  const pnlEmoji = realizedPnl >= 0 ? '🟢' : '🔴';
                  const formattedPnl = realizedPnl.toFixed(2);
                  const msg = `${pnlEmoji} <b>TRADE CLOSED</b>\nPair: <b>${trade.pair}</b> ${trade.direction}\nExit Price: <b>${exitPrice}</b>\nP&L: <b>${formattedPnl} USDT</b>`;
                  await sendTelegramMessage(telegram_token, telegram_chat_id, msg);
                }
              }
            } catch (err: any) {
              logs.push(`Failed to verify status for ${trade.pair}: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        logs.push('Binance sync error: ' + err.message);
      }
    }

    if (!bot_enabled) {
      logs.push('Bot is currently disabled. Skipping strategy scans.');
      await saveCronHeartbeat(logs);
      return NextResponse.json({ success: true, status: 'BOT_DISABLED', logs, durationMs: Date.now() - startTime });
    }

    if (!binance_api_key || !binance_secret_key) {
      logs.push('Binance API credentials missing. Trading halted.');
      await saveCronHeartbeat(logs);
      return NextResponse.json({ success: true, status: 'CREDENTIALS_MISSING', logs, durationMs: Date.now() - startTime });
    }

    const exchange = getBinanceClient(binance_api_key, binance_secret_key);

    // 3. Scan all pairs in parallel
    logs.push(`Scanning ${pairs.length} pairs concurrently...`);
    
    const scanResults = await Promise.all(
      pairs.map(async (pair: string) => {
        try {
          // Fetch 1m candles (limit 100 is sufficient for RSI(14) and MACD(12,26,9))
          const ohlcv = await exchange.fetchOHLCV(pair, '1m', undefined, 100);
          if (!ohlcv || ohlcv.length < 35) {
            return { pair, error: 'Insufficient candles data' };
          }

          const closePrices = ohlcv.map((candle: any) => candle[4]); // Index 4 is Close
          const analysis = analyzeStrategy(closePrices);

          return { pair, analysis };
        } catch (error: any) {
          return { pair, error: error.message };
        }
      })
    );

    // Process scan results
    for (const result of scanResults) {
      if ('error' in result) {
        logs.push(`Error scanning ${result.pair}: ${result.error}`);
        continue;
      }

      const { pair, analysis } = result;
      const { direction, rsi, macdLine, signalLine } = analysis;

      if (direction !== 'NEUTRAL') {
        logs.push(`Triggered ${direction} signal for ${pair} (RSI: ${rsi.toFixed(2)})`);

        // Check if there is an active trade for this pair
        const { data: activeTrades } = await supabase
          .from('trades')
          .select('id')
          .eq('pair', pair)
          .eq('status', 'OPEN');

        if (activeTrades && activeTrades.length > 0) {
          logs.push(`Trade already open for ${pair}. Skipping signal.`);
          continue;
        }

        // Place trade
        try {
          logs.push(`Executing ${direction} order on Binance Testnet for ${pair}...`);
          
          // Place trade and auto brackets on Binance
          const order = await placeFuturesOrder(
            exchange,
            pair,
            direction,
            risk_amount,
            tp_percent,
            sl_percent
          );

          const entryPrice = order.entryPrice;
          const tpPrice = direction === 'LONG' ? entryPrice * (1 + tp_percent / 100) : entryPrice * (1 - tp_percent / 100);
          const slPrice = direction === 'LONG' ? entryPrice * (1 - sl_percent / 100) : entryPrice * (1 + sl_percent / 100);

          // Save signal to Supabase
          const { data: savedSignal, error: sigErr } = await supabase
            .from('signals')
            .insert([{
              pair,
              direction,
              rsi,
              macd_line: macdLine,
              signal_line: signalLine,
              price: entryPrice,
            }])
            .select()
            .single();

          if (sigErr) {
            logs.push(`Failed to save signal to DB: ${sigErr.message}`);
          }

          // Save trade to Supabase
          const { error: tradeErr } = await supabase
            .from('trades')
            .insert([{
              pair,
              direction,
              entry_price: entryPrice,
              amount: order.amount,
              tp_price: tpPrice,
              sl_price: slPrice,
              status: 'OPEN',
              binance_order_id: order.entryOrder.id,
            }]);

          if (tradeErr) {
            logs.push(`Failed to save trade to DB: ${tradeErr.message}`);
          }

          // Send Telegram Alert
          const telegramMessage = `🟢 <b>NEW SIGNAL: ${pair} ${direction}</b>\n` +
            `Reason: RSI + MACD Cross\n` +
            `Entry: <b>${entryPrice}</b>\n` +
            `SL: <b>${slPrice.toFixed(4)}</b>\n` +
            `TP: <b>${tpPrice.toFixed(4)}</b>`;

          await sendTelegramMessage(telegram_token, telegram_chat_id, telegramMessage);
          logs.push(`Successfully opened trade and notified Telegram for ${pair}.`);

        } catch (err: any) {
          logs.push(`Failed to execute trade for ${pair}: ${err.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    logs.push(`Cron complete. Duration: ${duration}ms`);
    await saveCronHeartbeat(logs);
    return NextResponse.json({ success: true, logs, durationMs: duration });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logs.push(`Fatal error: ${error.message}`);
    console.error('Cron job error:', error);
    await saveCronHeartbeat(logs);
    return NextResponse.json({ success: false, error: error.message, logs, durationMs: duration }, { status: 500 });
  }
}

async function saveCronHeartbeat(logs: string[]) {
  try {
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (supabaseKey) {
      await supabase
        .from('settings')
        .update({
          last_scan_at: new Date().toISOString(),
          last_scan_logs: logs.slice(-15),
        })
        .eq('id', 1);
    }
  } catch (err) {
    console.error('Failed to log cron heartbeat to Supabase:', err);
  }
}
