import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { analyzeStrategy, calculateATR } from '@/lib/indicators';
import fs from 'fs';
import path from 'path';
import {
  getBinanceClient,
  placeFuturesOrder,
  cancelAllOpenOrders,
  fetchCurrentPrice,
  fetchFuturesBalance,
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
        tp_percent: 1.2,
        sl_percent: 1.5,
        risk_amount: 10.0,
        pairs: [
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
          'DOGEUSDT', 'TONUSDT', '1000SHIBUSDT', 'TRXUSDT', 'AVAXUSDT',
          'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'LINKUSDT', 'XLMUSDT',
          'BCHUSDT', 'OPUSDT', 'ARBUSDT', '1000PEPEUSDT', 'SUIUSDT',
          'NEARUSDT', 'APTUSDT', 'SEIUSDT', 'TIAUSDT', 'INJUSDT',
          'RENDERUSDT', 'FTMUSDT', 'AAVEUSDT'
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
      leverage,
      active_strategy,
    } = settings;

    const leverage_val = leverage || 20;
    const currentStrategy = active_strategy || 'RSI_MACD';

    const telegram_token = settings.telegram_token || process.env.TELEGRAM_TOKEN || '';
    const telegram_chat_id = settings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';

    // Dynamically select API credentials based on active trading mode
    const isDemo = (settings.trading_mode || 'DEMO') === 'DEMO';
    const binance_api_key = isDemo 
      ? (settings.binance_demo_api_key || settings.binance_api_key || process.env.BINANCE_API_KEY || '')
      : (settings.binance_real_api_key || process.env.BINANCE_API_KEY || '');
    const binance_secret_key = isDemo 
      ? (settings.binance_demo_secret_key || settings.binance_secret_key || process.env.BINANCE_SECRET_KEY || '')
      : (settings.binance_real_secret_key || process.env.BINANCE_SECRET_KEY || '');

    // 2. Manage open positions (Check if TP/SL were hit and close them in DB) - Live Only
    if (binance_api_key && binance_secret_key) {
      try {
        const exchange = getBinanceClient(binance_api_key, binance_secret_key, isDemo);
        
        // Fetch all open live trades in DB
        const { data: openTrades, error: dbError } = await supabase
          .from('trades')
          .select('*')
          .eq('status', 'OPEN')
          .eq('is_paper', false);

        if (dbError) {
          logs.push('DB Error fetching open trades: ' + dbError.message);
        } else if (openTrades && openTrades.length > 0) {
          logs.push(`Found ${openTrades.length} open trades in database. Checking statuses...`);
          
          // Bulk fetch all open positions from Binance to optimize latency and eliminate sequential HTTP requests
          let allPositions: any[] = [];
          try {
            allPositions = await exchange.fetchPositions();
          } catch (posErr: any) {
            logs.push(`⚠️ Bulk positions fetch failed: ${posErr.message}. Falling back to individual requests.`);
          }

          // Check position statuses on Binance
          for (const trade of openTrades) {
            try {
              let position = null;
              if (allPositions.length > 0) {
                position = allPositions.find((p: any) => {
                  const ccxtSym = p.symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                  const dbSym = (trade.pair as string).replace(/[^A-Z0-9]/gi, '').toUpperCase();
                  return ccxtSym.startsWith(dbSym) || ccxtSym === dbSym;
                });
              } else {
                // Fallback to sequential query if bulk failed
                const positions = await exchange.fetchPositions([trade.pair as string]);
                position = positions.find((p: any) => {
                  const ccxtSym = p.symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                  const dbSym = (trade.pair as string).replace(/[^A-Z0-9]/gi, '').toUpperCase();
                  return ccxtSym.startsWith(dbSym) || ccxtSym === dbSym;
                });
              }

              // If position size is 0 or undefined, it has been closed by TP/SL
              const currentSize = position ? parseFloat((position as any).contracts || (position as any).positionAmt || 0) : 0;
              
              if (Math.abs(currentSize) === 0) {
                logs.push(`Position for ${trade.pair} is closed on Binance. Resolving trade details...`);

                // Fetch recent user trades to calculate exact exit price & pnl
                const recentTrades = await exchange.fetchMyTrades(trade.pair as string, undefined, 20);
                // Look for the last trade that was an exit
                const exitSide = trade.direction === 'LONG' ? 'sell' : 'buy';
                const exitTrade = recentTrades
                  .reverse()
                  .find((t: any) => t.side.toLowerCase() === exitSide && parseFloat(t.amount) > 0);

                const exitPrice = exitTrade && exitTrade.price ? (exitTrade.price as number) : (trade.direction === 'LONG' ? trade.tp_price : trade.sl_price);
                const grossPnl = (exitPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);
                const entryFee = trade.entry_price * trade.amount * 0.0005; // 0.05% entry fee
                const exitFee = exitPrice * trade.amount * 0.0005; // 0.05% exit fee
                const realizedPnl = grossPnl - (entryFee + exitFee);

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
                  
                  // Fetch the new simulated balance
                  const { data: allClosed } = await supabase
                    .from('trades')
                    .select('pnl')
                    .eq('status', 'CLOSED');

                  const netPnl = (allClosed || []).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
                  const currentAccountBalance = 100.0 + netPnl;

                  // Calculate duration
                  const entryTime = new Date(trade.timestamp);
                  const exitTime = new Date();
                  const durationMs = exitTime.getTime() - entryTime.getTime();
                  
                  const totalSec = Math.floor(durationMs / 1000);
                  const hrs = Math.floor(totalSec / 3600);
                  const mins = Math.floor((totalSec % 3600) / 60);
                  const secs = totalSec % 60;
                  const durationStr = `${hrs > 0 ? `${hrs}h ` : ''}${mins > 0 ? `${mins}m ` : ''}${secs}s`;

                  // Format dates using simple UTC strings for server reliability
                  const entryTimeStr = entryTime.toUTCString();
                  const exitTimeStr = exitTime.toUTCString();

                  // Send Telegram update
                  const pnlEmoji = realizedPnl >= 0 ? '🟢' : '🔴';
                  const sign = realizedPnl >= 0 ? '+' : '';
                  const formattedPnl = realizedPnl.toFixed(2);

                  const tradeMargin = trade.margin ? parseFloat(trade.margin) : 10.0;
                  const tradeLeverage = trade.leverage || 20;
                  const totalSizeVal = tradeMargin * tradeLeverage;

                  // Fetch Real Account Balance from Real keys in settings
                  let realBalanceText = 'Not Configured';
                  const realKey = settings.binance_real_api_key || '';
                  const realSecret = settings.binance_real_secret_key || '';
                  if (realKey && realSecret) {
                    try {
                      const realExchange = getBinanceClient(realKey, realSecret, false);
                      const realBal = await fetchFuturesBalance(realExchange);
                      realBalanceText = `${realBal.toFixed(2)} USDT`;
                    } catch (e: any) {
                      realBalanceText = `Error: ${e.message}`;
                    }
                  }

                  const msg = `${pnlEmoji} <b>TRADE CLOSED</b>\n` +
                    `Pair: <b>${trade.pair}</b> ${trade.direction}\n` +
                    `Margin: <b>${tradeMargin.toFixed(2)} USDT</b>\n` +
                    `Leverage: <b>${tradeLeverage}x</b>\n` +
                    `Total Size: <b>${totalSizeVal.toFixed(2)} USDT</b>\n` +
                    `Exit Price: <b>${exitPrice}</b>\n` +
                    `P&L: <b>${sign}${formattedPnl} USDT</b>\n` +
                    `-----------------------------------\n` +
                    `Start Time: <b>${entryTimeStr}</b>\n` +
                    `End Time: <b>${exitTimeStr}</b>\n` +
                    `Duration: <b>${durationStr}</b>\n` +
                    `-----------------------------------\n` +
                    `Demo Balance: <b>${currentAccountBalance.toFixed(2)} USDT</b>\n` +
                    `Real Balance: <b>${realBalanceText}</b>`;

                  await sendTelegramMessage(telegram_token, telegram_chat_id, msg);
                  await sendWhatsAppAlert(msg, logs, 'trades');
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

    const exchange = getBinanceClient(binance_api_key, binance_secret_key, isDemo);

    // 3. Scan all pairs in parallel
    const scanStartTime = Date.now();
    logs.push(`Scanning ${pairs.length} pairs concurrently...`);
    
    const scanResults = await Promise.all(
      pairs.map(async (pair: string) => {
        try {
          // Determine timeframe based on active strategy
          let timeframe = '1m';
          if (currentStrategy === 'DOUBLE_EMA_5M') {
            timeframe = '5m';
          } else if (currentStrategy === 'DOUBLE_EMA_15M') {
            timeframe = '15m';
          }

          // Fetch 250 candles to satisfy EMA 200 length requirements
          const ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, 250);
          if (!ohlcv || ohlcv.length < 205) {
            return { pair, error: 'Insufficient candles data (requires at least 205 candles)' };
          }

          // Fetch 1h candles for trend alignment
          let ohlcv1h: any[] = [];
          try {
            ohlcv1h = await exchange.fetchOHLCV(pair, '1h', undefined, 250);
          } catch (err: any) {
            logs.push(`Warning: Failed to fetch 1H candles for ${pair}: ${err.message}`);
          }

          const highs = ohlcv.map((candle: any) => candle[2]);
          const lows = ohlcv.map((candle: any) => candle[3]);
          const closePrices = ohlcv.map((candle: any) => candle[4]);
          const currentPrice = closePrices[closePrices.length - 1];

          // Calculate current Average True Range percentage to drive dynamic TP/SL targets based on market volatility
          const atrList = calculateATR(highs, lows, closePrices, 14);
          const currentAtr = atrList[atrList.length - 1] || 0;
          const atrPercent = currentPrice > 0 ? (currentAtr / currentPrice) * 100 : 0;

          const pairOverrides = settings.pair_overrides || {};
          const disabledStrats = pairOverrides[pair]?.disabled_strategies || [];

          const rsiMacdAnalysis = disabledStrats.includes('RSI_MACD') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'RSI_MACD', undefined, pair);
          const bbRsiAnalysis = disabledStrats.includes('BOLLINGER_RSI') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'BOLLINGER_RSI', undefined, pair);
          const bbRsiOptAnalysis = disabledStrats.includes('BOLLINGER_RSI_OPT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'BOLLINGER_RSI_OPT', undefined, pair);
          const doubleEmaAnalysis = disabledStrats.includes('DOUBLE_EMA') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'DOUBLE_EMA', ohlcv1h as any, pair);
          const doubleEmaOptAnalysis = disabledStrats.includes('DOUBLE_EMA_OPT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'DOUBLE_EMA_OPT', ohlcv1h as any, pair);
          const doubleEma5mAnalysis = disabledStrats.includes('DOUBLE_EMA_5M') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'DOUBLE_EMA_5M', ohlcv1h as any, pair);
          const doubleEma15mAnalysis = disabledStrats.includes('DOUBLE_EMA_15M') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'DOUBLE_EMA_15M', ohlcv1h as any, pair);
          const supertrendEmaAnalysis = disabledStrats.includes('SUPERTREND_EMA') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'SUPERTREND_EMA', ohlcv1h as any, pair);
          const supertrendEmaOptAnalysis = disabledStrats.includes('SUPERTREND_EMA_OPT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'SUPERTREND_EMA_OPT', ohlcv1h as any, pair);
          const stochRsiMacdAnalysis = disabledStrats.includes('STOCH_RSI_MACD') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'STOCH_RSI_MACD', undefined, pair);
          const atrBreakoutAnalysis = disabledStrats.includes('ATR_BREAKOUT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'ATR_BREAKOUT', ohlcv1h as any, pair);
          const swingStructureAnalysis = disabledStrats.includes('SWING_STRUCTURE') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'SWING_STRUCTURE', ohlcv1h as any, pair);
          const macdDivergenceAnalysis = disabledStrats.includes('MACD_DIVERGENCE') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'MACD_DIVERGENCE', undefined, pair);
          const kdjReversionAnalysis = disabledStrats.includes('KDJ_REVERSION') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'KDJ_REVERSION', undefined, pair);
          const kdjReversionOptAnalysis = disabledStrats.includes('KDJ_REVERSION_OPT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'KDJ_REVERSION_OPT', undefined, pair);
          const fibonacciPullbackAnalysis = disabledStrats.includes('FIBONACCI_PULLBACK') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'FIBONACCI_PULLBACK', ohlcv1h as any, pair);
          const ichimokuCloudbreakAnalysis = disabledStrats.includes('ICHIMOKU_CLOUDBREAK') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'ICHIMOKU_CLOUDBREAK', ohlcv1h as any, pair);
          const vwapReversionAnalysis = disabledStrats.includes('VWAP_REVERSION') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'VWAP_REVERSION', undefined, pair);
          const vwapReversionOptAnalysis = disabledStrats.includes('VWAP_REVERSION_OPT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'VWAP_REVERSION_OPT', undefined, pair);
          const combinationStrategiesAnalysis = disabledStrats.includes('COMBINATION_STRATEGIES') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'COMBINATION_STRATEGIES', ohlcv1h as any, pair);
          const rsiStochEmaTrendAnalysis = disabledStrats.includes('RSI_STOCH_EMA_TREND') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'RSI_STOCH_EMA_TREND', undefined, pair);
          const cmfBreakoutAnalysis = disabledStrats.includes('CMF_BREAKOUT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'CMF_BREAKOUT', undefined, pair);
          const hullMaCrossoverAnalysis = disabledStrats.includes('HULL_MA_CROSSOVER') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'HULL_MA_CROSSOVER', undefined, pair);
          const donchianBreakoutAnalysis = disabledStrats.includes('DONCHIAN_BREAKOUT') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'DONCHIAN_BREAKOUT', undefined, pair);
          const adxDiMomentumAnalysis = disabledStrats.includes('ADX_DI_MOMENTUM') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'ADX_DI_MOMENTUM', undefined, pair);
          const regimeEnsembleProAnalysis = disabledStrats.includes('REGIME_ENSEMBLE_PRO') ? { signal: 'NEUTRAL' } : analyzeStrategy(ohlcv as any, 'REGIME_ENSEMBLE_PRO', ohlcv1h as any, pair);

          return {
            pair,
            currentPrice,
            atrPercent,
            analyses: {
              RSI_MACD: rsiMacdAnalysis,
              BOLLINGER_RSI: bbRsiAnalysis,
              BOLLINGER_RSI_OPT: bbRsiOptAnalysis,
              DOUBLE_EMA: doubleEmaAnalysis,
              DOUBLE_EMA_OPT: doubleEmaOptAnalysis,
              DOUBLE_EMA_5M: doubleEma5mAnalysis,
              DOUBLE_EMA_15M: doubleEma15mAnalysis,
              SUPERTREND_EMA: supertrendEmaAnalysis,
              SUPERTREND_EMA_OPT: supertrendEmaOptAnalysis,
              STOCH_RSI_MACD: stochRsiMacdAnalysis,
              ATR_BREAKOUT: atrBreakoutAnalysis,
              SWING_STRUCTURE: swingStructureAnalysis,
              MACD_DIVERGENCE: macdDivergenceAnalysis,
              KDJ_REVERSION: kdjReversionAnalysis,
              KDJ_REVERSION_OPT: kdjReversionOptAnalysis,
              FIBONACCI_PULLBACK: fibonacciPullbackAnalysis,
              ICHIMOKU_CLOUDBREAK: ichimokuCloudbreakAnalysis,
              VWAP_REVERSION: vwapReversionAnalysis,
              VWAP_REVERSION_OPT: vwapReversionOptAnalysis,
              COMBINATION_STRATEGIES: combinationStrategiesAnalysis,
              RSI_STOCH_EMA_TREND: rsiStochEmaTrendAnalysis,
              CMF_BREAKOUT: cmfBreakoutAnalysis,
              HULL_MA_CROSSOVER: hullMaCrossoverAnalysis,
              DONCHIAN_BREAKOUT: donchianBreakoutAnalysis,
              ADX_DI_MOMENTUM: adxDiMomentumAnalysis,
              REGIME_ENSEMBLE_PRO: regimeEnsembleProAnalysis,
            }
          };
        } catch (error: any) {
          return { pair, error: error.message };
        }
      })
    );

    const fetchDuration = Date.now() - scanStartTime;
    logs.push(`Binance fetch & Technical Analysis complete in ${fetchDuration}ms.`);

    // Build prices map for paper trade matching
    const pricesMap: Record<string, number> = {};
    for (const result of scanResults) {
      if (result && 'currentPrice' in result) {
        pricesMap[result.pair] = result.currentPrice;
      }
    }

    // 3b. Manage Open Paper Trades (Hypothetical Simulation)
    try {
      const { data: openPaperTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('status', 'OPEN')
        .eq('is_paper', true);

      if (openPaperTrades && openPaperTrades.length > 0) {
        logs.push(`Found ${openPaperTrades.length} open paper trades. Evaluating exits...`);
        for (const trade of openPaperTrades) {
          const livePrice = pricesMap[trade.pair];
          if (!livePrice) continue;

          const entryPrice = parseFloat(trade.entry_price as any);
          let tpPrice = parseFloat(trade.tp_price as any);
          let slPrice = parseFloat(trade.sl_price as any);
          const isLong = trade.direction === 'LONG';

          // 1. Trailing Stop Loss (TSL) Rule for Optimized Strategies
          if (trade.strategy && trade.strategy.endsWith('_OPT')) {
            const distance = Math.abs(tpPrice - entryPrice);
            if (isLong) {
              const triggerPrice = entryPrice + 0.5 * distance;
              if (livePrice >= triggerPrice && slPrice !== entryPrice) {
                await supabase
                  .from('trades')
                  .update({ sl_price: entryPrice })
                  .eq('id', trade.id);
                slPrice = entryPrice;
                logs.push(`[TSL Triggered] SL moved to entry price ${entryPrice} for ${trade.pair} (${trade.strategy})`);
              }
            } else {
              const triggerPrice = entryPrice - 0.5 * distance;
              if (livePrice <= triggerPrice && slPrice !== entryPrice) {
                await supabase
                  .from('trades')
                  .update({ sl_price: entryPrice })
                  .eq('id', trade.id);
                slPrice = entryPrice;
                logs.push(`[TSL Triggered] SL moved to entry price ${entryPrice} for ${trade.pair} (${trade.strategy})`);
              }
            }
          }

          let hitTp = false;
          let hitSl = false;

          // 2. 48-Hour Expiration / Breakeven Rule
          const hoursOpen = (Date.now() - new Date(trade.timestamp).getTime()) / (1000 * 60 * 60);
          let isExpiredClose = false;
          
          if (hoursOpen >= 48) {
            const isProfit = isLong ? (livePrice > entryPrice) : (livePrice < entryPrice);
            if (isProfit) {
              hitTp = true;
              tpPrice = livePrice;
              isExpiredClose = true;
              logs.push(`[48h Expired Profit] Closing trade ${trade.id} immediately at current price ${livePrice} (Profit).`);
            } else {
              if (parseFloat(trade.tp_price as any) !== entryPrice) {
                await supabase
                  .from('trades')
                  .update({ tp_price: entryPrice })
                  .eq('id', trade.id);
                tpPrice = entryPrice;
                logs.push(`[48h Expired Loss] Moved TP to entry price ${entryPrice} for breakeven on ${trade.pair} (${trade.strategy})`);
              }
            }
          }

          if (!isExpiredClose) {
            if (isLong) {
              if (livePrice >= tpPrice) hitTp = true;
              else if (livePrice <= slPrice) hitSl = true;
            } else {
              // SHORT
              if (livePrice <= tpPrice) hitTp = true;
              else if (livePrice >= slPrice) hitSl = true;
            }
          }

          if (hitTp || hitSl) {
            const exitPrice = hitTp ? tpPrice : slPrice;
            const priceDiff = exitPrice - entryPrice;
            const leverage = trade.leverage || 20;
            const margin = parseFloat(trade.margin as any || 1.0);
            const pnlFactor = priceDiff / entryPrice;
            const pnl = pnlFactor * leverage * margin * (isLong ? 1 : -1);

            const { error: closeErr } = await supabase
              .from('trades')
              .update({
                status: 'CLOSED',
                exit_price: exitPrice,
                pnl: pnl,
                closed_at: new Date().toISOString(),
              })
              .eq('id', trade.id);

            if (closeErr) {
              logs.push(`Failed to close paper trade ${trade.id}: ${closeErr.message}`);
            } else {
              logs.push(`[Paper Sandbox] Closed ${trade.pair} ${trade.strategy} ${trade.direction} trade at exit price ${exitPrice} (PnL: ${pnl.toFixed(2)} USDT)`);
            }
          }
        }
      }
    } catch (paperErr: any) {
      logs.push(`Error managing paper trades: ${paperErr.message}`);
    }

    const paperDuration = Date.now() - startTime - fetchDuration;
    logs.push(`Paper trades audit complete in ${paperDuration}ms.`);

     // 3c. Evaluate and place signals for all strategies
     const strategiesList = [
       'RSI_MACD',
       'COMBINATION_STRATEGIES',
       'REGIME_ENSEMBLE_PRO',
       'BOLLINGER_RSI',
       'BOLLINGER_RSI_OPT',
       'DOUBLE_EMA',
       'DOUBLE_EMA_OPT',
       'DOUBLE_EMA_5M',
       'DOUBLE_EMA_15M',
       'SUPERTREND_EMA',
       'SUPERTREND_EMA_OPT',
       'STOCH_RSI_MACD',
       'ATR_BREAKOUT',
       'SWING_STRUCTURE',
       'MACD_DIVERGENCE',
       'KDJ_REVERSION',
       'KDJ_REVERSION_OPT',
       'FIBONACCI_PULLBACK',
       'ICHIMOKU_CLOUDBREAK',
       'VWAP_REVERSION',
       'VWAP_REVERSION_OPT',
       'RSI_STOCH_EMA_TREND',
       'CMF_BREAKOUT',
       'HULL_MA_CROSSOVER',
       'DONCHIAN_BREAKOUT',
       'ADX_DI_MOMENTUM'
     ];

    for (const result of scanResults) {
      if (!result || 'error' in result) {
        if (result) logs.push(`Error scanning ${result.pair}: ${result.error}`);
        continue;
      }

      const { pair, currentPrice, analyses, atrPercent } = result;

      for (const strategyName of strategiesList) {
        const analysis = analyses[strategyName as keyof typeof analyses];
        if (!analysis || analysis.direction === 'NEUTRAL') continue;

        const { direction, rsi, macdLine, signalLine } = analysis;
        const isPaper = strategyName !== currentStrategy;

        logs.push(`Signal generated: ${pair} ${direction} via ${strategyName} (isPaper: ${isPaper})`);

        // Check if there is an active trade for this pair under this strategy and paper status
        const { data: existingTrades } = await supabase
          .from('trades')
          .select('id')
          .eq('pair', pair)
          .eq('strategy', strategyName)
          .eq('is_paper', isPaper)
          .eq('status', 'OPEN');

        if (existingTrades && existingTrades.length > 0) {
          logs.push(`Trade already open for ${pair} [Strategy: ${strategyName}, isPaper: ${isPaper}]. Skipping.`);
          continue;
        }

        // Determine parameters (use overrides if configured in settings)
        const overrides = settings.pair_overrides || {};

        // Cooldown check to prevent immediate re-entry after closing a trade
        const cooldownHours = overrides.GLOBAL_COOLDOWN_HOURS !== undefined ? parseFloat(overrides.GLOBAL_COOLDOWN_HOURS) : 0.0;
        if (cooldownHours > 0) {
          const cooldownTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
          const { data: recentlyClosedTrades } = await supabase
            .from('trades')
            .select('id')
            .eq('pair', pair)
            .eq('strategy', strategyName)
            .eq('is_paper', isPaper)
            .eq('status', 'CLOSED')
            .gte('closed_at', cooldownTime);

          if (recentlyClosedTrades && recentlyClosedTrades.length > 0) {
            logs.push(`Trade recently closed for ${pair} [Strategy: ${strategyName}, isPaper: ${isPaper}] within the last ${cooldownHours} hour(s). Cooldown active. Skipping.`);
            continue;
          }
        }

        const pairOverride = overrides[pair] || {};

        const activeLeverage = pairOverride.leverage !== undefined ? parseInt(pairOverride.leverage) : 20;
        
        let activeRiskAmount = 1.0;
        if (pairOverride.risk_amount !== undefined) {
          activeRiskAmount = parseFloat(pairOverride.risk_amount);
        } else if (pair.startsWith('BTC') || pair.startsWith('ETH')) {
          activeRiskAmount = 5.0; // Higher default margin for BTC/ETH
        }

        // Volatility-based target calculation (ATR): TP is 2.0x ATR (positive ratio), SL is 1.5x ATR (breathing room)
        const pctAtr = atrPercent || 1.0;
        let dynamicTp = Math.max(1.5, parseFloat((2.0 * pctAtr).toFixed(2))); // Min 1.5% TP
        let dynamicSl = Math.max(1.0, parseFloat((1.5 * pctAtr).toFixed(2))); // Min 1.0% SL

        // Override default ATR targets with strategy-specific targets (such as SWING_STRUCTURE's S&R swing levels)
        if (analysis.tpPercent !== undefined) {
          dynamicTp = analysis.tpPercent;
        }
        if (analysis.slPercent !== undefined) {
          dynamicSl = analysis.slPercent;
        }

        const activeTpPercent = pairOverride.tp_percent !== undefined 
          ? parseFloat(pairOverride.tp_percent) 
          : dynamicTp;
        const activeSlPercent = pairOverride.sl_percent !== undefined 
          ? parseFloat(pairOverride.sl_percent) 
          : dynamicSl;

        const tpPrice = direction === 'LONG' ? currentPrice * (1 + activeTpPercent / 100) : currentPrice * (1 - activeTpPercent / 100);
        const slPrice = direction === 'LONG' ? currentPrice * (1 - activeSlPercent / 100) : currentPrice * (1 + activeSlPercent / 100);

        if (!isPaper) {
          // --- LIVE TRADING (Binance execution) ---
          try {
            logs.push(`Executing ${direction} order on Binance for ${pair} via active strategy ${strategyName}...`);
            const order = await placeFuturesOrder(
              exchange,
              pair,
              direction,
              activeRiskAmount,
              activeTpPercent,
              activeSlPercent,
              activeLeverage
            );

            // Save signal
            await supabase.from('signals').insert([{
              pair,
              direction,
              rsi,
              macd_line: macdLine,
              signal_line: signalLine,
              price: order.entryPrice,
            }]);

            // Save live trade
            await supabase.from('trades').insert([{
              pair,
              direction,
              entry_price: order.entryPrice,
              amount: order.amount,
              tp_price: tpPrice,
              sl_price: slPrice,
              status: 'OPEN',
              leverage: activeLeverage,
              margin: activeRiskAmount,
              binance_order_id: order.entryOrder.id,
              strategy: strategyName,
              is_paper: false,
            }]);

            // Send Telegram alert
            const finalStrategyName = strategyName === 'BOLLINGER_RSI'
              ? 'Bollinger Bands + RSI Reversion'
              : strategyName === 'BOLLINGER_RSI_OPT'
              ? 'Bollinger Bands + RSI Reversion (Optimized)'
              : strategyName === 'DOUBLE_EMA'
              ? 'Double EMA Crossover'
              : strategyName === 'DOUBLE_EMA_OPT'
              ? 'Double EMA Crossover (Optimized)'
              : strategyName === 'DOUBLE_EMA_5M'
              ? 'Double EMA 5-Minute'
              : strategyName === 'DOUBLE_EMA_15M'
              ? 'Double EMA 15-Minute'
              : strategyName === 'SUPERTREND_EMA'
              ? 'SuperTrend + 200 EMA'
              : strategyName === 'SUPERTREND_EMA_OPT'
              ? 'SuperTrend + 200 EMA (Optimized)'
              : strategyName === 'STOCH_RSI_MACD'
              ? 'Stochastic RSI + MACD Crossover'
              : strategyName === 'ATR_BREAKOUT'
              ? 'ATR Channel Breakout'
              : strategyName === 'SWING_STRUCTURE'
              ? 'Swing S&R Structure'
              : strategyName === 'MACD_DIVERGENCE'
              ? 'MACD Reversal Divergence'
              : strategyName === 'KDJ_REVERSION'
              ? 'KDJ + StochRSI Reversion'
              : strategyName === 'KDJ_REVERSION_OPT'
              ? 'KDJ + StochRSI Reversion (Optimized)'
              : strategyName === 'FIBONACCI_PULLBACK'
              ? 'EMA Fibonacci Pullback'
              : strategyName === 'ICHIMOKU_CLOUDBREAK'
              ? 'Ichimoku Cloud Breakout'
              : strategyName === 'VWAP_REVERSION'
              ? 'VWAP Volatility Band Reversion'
              : strategyName === 'VWAP_REVERSION_OPT'
              ? 'VWAP Volatility Band Reversion (Optimized)'
              : strategyName === 'COMBINATION_STRATEGIES'
              ? 'Combination Portfolio Dispatcher'
              : strategyName === 'REGIME_ENSEMBLE_PRO'
              ? 'Regime-Aware Ensemble Pro'
              : strategyName === 'RSI_STOCH_EMA_TREND'
              ? 'RSI + Stochastic + EMA Trend'
              : strategyName === 'CMF_BREAKOUT'
              ? 'Chaikin Money Flow Breakout'
              : strategyName === 'HULL_MA_CROSSOVER'
              ? 'Hull Moving Average Crossover'
              : strategyName === 'DONCHIAN_BREAKOUT'
              ? 'Donchian Channel Breakout'
              : strategyName === 'ADX_DI_MOMENTUM'
              ? 'ADX DI Momentum Crossover'
              : 'RSI + MACD Momentum Crossover';

            // Query live strategy and pair win rates from database
            let expectedWinRateStr = 'N/A (New Strategy)';
            let pairWinRateStr = 'N/A (No Trades)';
            let calculatedProbability = 65; // Fallback base probability
            
            try {
              const { data: stratTrades } = await supabase
                .from('trades')
                .select('pnl, pair')
                .eq('strategy', strategyName)
                .eq('status', 'CLOSED');

              const totalStratTrades = stratTrades?.length || 0;
              if (totalStratTrades > 0) {
                const winStratTrades = stratTrades?.filter((t: any) => parseFloat(t.pnl || 0) > 0).length || 0;
                const winRatePct = (winStratTrades / totalStratTrades) * 100;
                expectedWinRateStr = `${winRatePct.toFixed(1)}% (${winStratTrades}/${totalStratTrades} wins)`;
                
                // Pair specific win rate
                const pairTrades = (stratTrades || []).filter((t: any) => t.pair === pair);
                const totalPairTrades = pairTrades.length;
                if (totalPairTrades > 0) {
                  const winPairTrades = pairTrades.filter((t: any) => parseFloat(t.pnl || 0) > 0).length || 0;
                  const pairWinRatePct = (winPairTrades / totalPairTrades) * 100;
                  pairWinRateStr = `${pairWinRatePct.toFixed(1)}% (${winPairTrades}/${totalPairTrades} wins)`;
                  calculatedProbability = Math.round(pairWinRatePct);
                } else {
                  calculatedProbability = Math.round(winRatePct);
                }
              }
            } catch (err) {
              console.error('Error fetching strategy win rate for telegram:', err);
            }

            // Adjust probability based on real-time indicator strength (ADX or RSI)
            let indicatorModifier = 0;
            const indicatorVal = parseFloat(rsi as any || 0);
            
            if (strategyName.includes('DOUBLE_EMA') || strategyName.includes('SUPERTREND') || strategyName.includes('ATR_BREAKOUT') || strategyName.includes('SWING_STRUCTURE')) {
              // For trend-following strategies, rsi stores the ADX value
              if (indicatorVal > 35) {
                indicatorModifier = 8; // Strong trend confirmation
              } else if (indicatorVal > 25) {
                indicatorModifier = 4;
              } else if (indicatorVal < 20) {
                indicatorModifier = -5; // Weak trend
              }
            } else {
              // For mean-reversion strategies, rsi stores standard RSI
              if (direction === 'LONG' && indicatorVal < 25) {
                indicatorModifier = 6; // Deep oversold, higher recovery chance
              } else if (direction === 'SHORT' && indicatorVal > 75) {
                indicatorModifier = 6; // Deep overbought
              }
            }
            
            const finalWinOdds = Math.min(95, Math.max(50, calculatedProbability + indicatorModifier));

            const totalVal = activeRiskAmount * activeLeverage;
            const entryFeeVal = totalVal * 0.0005;
            
            // Expected Net Profit calculation (at TP)
            const exitFeeTp = totalVal * (1 + activeTpPercent / 100) * 0.0005;
            const expectedGrossProfit = totalVal * (activeTpPercent / 100);
            const expectedNetProfit = expectedGrossProfit - (entryFeeVal + exitFeeTp);

            // Expected Net Loss calculation (at SL)
            const exitFeeSl = totalVal * (1 - activeSlPercent / 100) * 0.0005;
            const expectedGrossLoss = totalVal * (activeSlPercent / 100);
            const expectedNetLoss = expectedGrossLoss + (entryFeeVal + exitFeeSl);

            const telegramMessage = `🟢 <b>NEW SIGNAL: ${pair} ${direction}</b>\n` +
              `Reason: <b>${finalStrategyName}</b>\n` +
              `Margin: <b>${activeRiskAmount.toFixed(2)} USDT</b>\n` +
              `Leverage: <b>${activeLeverage}x</b>\n` +
              `Total Size: <b>${totalVal.toFixed(2)} USDT</b>\n` +
              `Entry Price: <b>${order.entryPrice}</b>\n` +
              `SL: <b>${slPrice.toFixed(4)}</b> (Target: -${activeSlPercent.toFixed(2)}% / -${expectedNetLoss.toFixed(2)} USDT)\n` +
              `TP: <b>${tpPrice.toFixed(4)}</b> (Target: +${activeTpPercent.toFixed(2)}% / +${expectedNetProfit.toFixed(2)} USDT)\n\n` +
              `🎯 <b>Strategy Win Chance:</b> <code>${expectedWinRateStr}</code>\n` +
              `📈 <b>Pair Win Chance (${pair}):</b> <code>${pairWinRateStr}</code>\n` +
              `🔮 <b>Calculated Signal Win Odds:</b> <code>${finalWinOdds}%</code>\n\n` +
              `💰 <b>Expected Net Profit (on TP):</b> <code>+${expectedNetProfit.toFixed(4)} USDT</code> (Fees: -${(entryFeeVal + exitFeeTp).toFixed(4)} USDT)`;

            await sendTelegramMessage(telegram_token, telegram_chat_id, telegramMessage);
            await sendWhatsAppAlert(telegramMessage, logs, 'signals');
            logs.push(`Successfully opened live trade for ${pair}.`);

          } catch (err: any) {
            logs.push(`Failed to execute live trade for ${pair}: ${err.message}`);
            const failMsg = `⚠️ <b>TRADE EXECUTION FAILED</b>\n` +
              `Pair: <b>${pair}</b> ${direction}\n` +
              `Error: <code>${err.message}</code>\n` +
              `Please check your Binance wallet balance, margin settings, or API key permissions.`;
            await sendTelegramMessage(telegram_token, telegram_chat_id, failMsg);
            await sendWhatsAppAlert(failMsg, logs, 'trades');
          }
        } else {
          // --- PAPER TRADING (Virtual Sandbox simulation only) ---
          try {
            logs.push(`Logging [Paper Sandbox] trade for ${pair} via strategy ${strategyName}...`);
            const paperAmount = (activeRiskAmount * activeLeverage) / currentPrice;

            await supabase.from('trades').insert([{
              pair,
              direction,
              entry_price: currentPrice,
              amount: paperAmount,
              tp_price: tpPrice,
              sl_price: slPrice,
              status: 'OPEN',
              leverage: activeLeverage,
              margin: activeRiskAmount,
              strategy: strategyName,
              is_paper: true,
            }]);

            logs.push(`Successfully logged open paper trade for ${pair}.`);
          } catch (paperTradeErr: any) {
            logs.push(`Failed to save paper trade to DB: ${paperTradeErr.message}`);
          }
        }
      }
    }

    const signalsDuration = Date.now() - startTime - fetchDuration - paperDuration;
    logs.push(`Active strategies signal execution complete in ${signalsDuration}ms.`);

    // 4. Hourly System Check & Trades Report
    try {
      const now = new Date();
      const lastHourly = settings.last_hourly_report_at ? new Date(settings.last_hourly_report_at) : null;
      
      // If never run or if the current minute is >= 5 and we haven't sent a report in this current hour yet
      const currentHourStr = now.toISOString().slice(0, 13); // e.g. "2026-08-16T10"
      const lastHourlyHourStr = lastHourly ? lastHourly.toISOString().slice(0, 13) : '';
      
      if (!lastHourly || (now.getMinutes() >= 5 && currentHourStr !== lastHourlyHourStr)) {
        logs.push('Executing scheduled hourly report...');
        
        // Run diagnostics checks
        let dbOk = false;
        try {
          const { data } = await supabase.from('settings').select('id').eq('id', 1).single();
          dbOk = !!data;
        } catch {}

        let binanceOk = false;
        let simulatedBalance = 100.0;
        try {
          const exchange = getBinanceClient(binance_api_key, binance_secret_key, isDemo);
          await fetchFuturesBalance(exchange);
          binanceOk = true;

          // Fetch all closed trades to compute simulated balance
          const { data: allClosed } = await supabase
            .from('trades')
            .select('pnl')
            .eq('status', 'CLOSED');
          const netPnl = (allClosed || []).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
          simulatedBalance = 100.0 + netPnl;
        } catch {}

        // Fetch trades in last 1 hour
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const { data: hourlyTrades } = await supabase
          .from('trades')
          .select('*')
          .eq('status', 'CLOSED')
          .gte('closed_at', oneHourAgo.toISOString());

        let tradesSummary = '• No trades closed in the last hour.';
        if (hourlyTrades && hourlyTrades.length > 0) {
          const summaryMap: { [key: string]: { pnl: number, count: number } } = {};
          hourlyTrades.forEach((t: any) => {
            const key = `${t.pair} (${t.is_paper ? 'Paper' : 'Live'})`;
            if (!summaryMap[key]) {
              summaryMap[key] = { pnl: 0, count: 0 };
            }
            summaryMap[key].pnl += parseFloat(t.pnl || 0);
            summaryMap[key].count += 1;
          });

          tradesSummary = Object.keys(summaryMap)
            .map((key) => {
              const item = summaryMap[key];
              const pnlPrefix = item.pnl >= 0 ? '+' : '';
              return `• <b>${key}</b>: <b>${pnlPrefix}${item.pnl.toFixed(2)} USDT</b> (${item.count} trade${item.count > 1 ? 's' : ''})`;
            })
            .join('\n');
        }

        const hourlyMsg = `⏰ <b>HOURLY STATUS REPORT</b>\n` +
          `-----------------------------------\n` +
          `• <b>Database Connection</b>: ${dbOk ? '🟢 OK' : '🔴 ERROR'}\n` +
          `• <b>Binance Balance</b>: ${binanceOk ? `🟢 ${simulatedBalance.toFixed(2)} USDT` : '🔴 ERROR'}\n` +
          `• <b>Engine Scanner</b>: 🟢 RUNNING\n` +
          `-----------------------------------\n` +
          `<b>Trades Closed Last 1h:</b>\n${tradesSummary}`;

        await sendTelegramMessage(telegram_token, telegram_chat_id, hourlyMsg);
        await sendWhatsAppAlert(hourlyMsg, logs, 'hourly');
        
        // Update database timestamp
        await supabase
          .from('settings')
          .update({ last_hourly_report_at: now.toISOString() })
          .eq('id', 1);
        
        logs.push('Hourly report sent successfully.');
      }
    } catch (hourlyErr: any) {
      logs.push(`Hourly report error: ${hourlyErr.message}`);
    }

    // 5. Daily Performance Report (9:00 PM Local Time / 18:00 UTC)
    try {
      const now = new Date();
      const currentHourUtc = now.getUTCHours();
      const lastDaily = settings.last_daily_report_at ? new Date(settings.last_daily_report_at) : null;
      
      // Check if it is 9 PM local time (18:00 UTC)
      const is9PMLocal = currentHourUtc === 18;
      const alreadySentToday = lastDaily && lastDaily.getUTCDate() === now.getUTCDate() && lastDaily.getUTCMonth() === now.getUTCMonth() && lastDaily.getUTCFullYear() === now.getUTCFullYear();

      if (is9PMLocal && !alreadySentToday) {
        logs.push('Executing scheduled daily report...');

        // Fetch trades closed since start of local day (9 PM local today - 21 hours = 12 AM local today = 21:00 UTC previous day)
        const startOfLocalDay = new Date(now);
        startOfLocalDay.setUTCHours(21, 0, 0, 0);
        if (startOfLocalDay > now) {
          startOfLocalDay.setDate(startOfLocalDay.getDate() - 1);
        }

        const { data: dailyTrades } = await supabase
          .from('trades')
          .select('*')
          .eq('status', 'CLOSED')
          .gte('closed_at', startOfLocalDay.toISOString());

        const totalTrades = dailyTrades?.length || 0;
        const wins = dailyTrades?.filter((t: any) => parseFloat(t.pnl || 0) > 0).length || 0;
        const losses = totalTrades - wins;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const netPnl = (dailyTrades || []).reduce((sum: number, t: any) => sum + parseFloat(t.pnl || 0), 0);

        let tradesList = '• No trades completed today.';
        if (dailyTrades && dailyTrades.length > 0) {
          const summaryMap: { [key: string]: { pnl: number, wins: number, losses: number } } = {};
          dailyTrades.forEach((t: any) => {
            const key = `${t.pair} (${t.is_paper ? 'Paper' : 'Live'})`;
            if (!summaryMap[key]) {
              summaryMap[key] = { pnl: 0, wins: 0, losses: 0 };
            }
            const pnl = parseFloat(t.pnl || 0);
            summaryMap[key].pnl += pnl;
            if (pnl > 0) {
              summaryMap[key].wins += 1;
            } else {
              summaryMap[key].losses += 1;
            }
          });

          tradesList = Object.keys(summaryMap)
            .map((key) => {
              const item = summaryMap[key];
              const pnlPrefix = item.pnl >= 0 ? '+' : '';
              return `• <b>${key}</b>: <b>${pnlPrefix}${item.pnl.toFixed(2)} USDT</b> (${item.wins}W / ${item.losses}L)`;
            })
            .join('\n');
        }

        const dailyMsg = `📊 <b>DAILY PERFORMANCE REPORT (9 PM)</b>\n` +
          `-----------------------------------\n` +
          `• <b>Total Trades</b>: <b>${totalTrades}</b>\n` +
          `• <b>Wins / Losses</b>: <b>${wins} / ${losses}</b>\n` +
          `• <b>Win Rate</b>: <b>${winRate.toFixed(1)}%</b>\n` +
          `• <b>Net P&L</b>: <b>${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} USDT</b>\n` +
          `-----------------------------------\n` +
          `<b>Completed Trades Today:</b>\n${tradesList}`;

        await sendTelegramMessage(telegram_token, telegram_chat_id, dailyMsg);
        await sendWhatsAppAlert(dailyMsg, logs, 'daily');

        // Update database timestamp
        await supabase
          .from('settings')
          .update({ last_daily_report_at: now.toISOString() })
          .eq('id', 1);

        logs.push('Daily report sent successfully.');
      }
    } catch (dailyErr: any) {
      logs.push(`Daily report error: ${dailyErr.message}`);
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

async function sendWhatsAppAlert(message: string, logs: string[], category: 'signals' | 'trades' | 'hourly' | 'daily') {
  try {
    // Query settings configuration dynamically from Supabase
    const { data: settings, error: dbErr } = await supabase
      .from('settings')
      .select('whatsapp_config')
      .eq('id', 1)
      .single();

    if (dbErr || !settings || !settings.whatsapp_config) {
      logs.push(`WhatsApp config fetch failed: ${dbErr?.message || 'Empty settings configuration'}`);
      return;
    }

    const config = settings.whatsapp_config;
    if (!config.whatsapp_enabled || !config.whatsapp_recipients || config.whatsapp_recipients.length === 0) {
      return;
    }

    // Verify checklist filters configuration
    const filters = config.whatsapp_filters || { signals: true, trades: true, hourly: false, daily: false };
    if (!filters[category]) {
      logs.push(`WhatsApp notifications: skipped forwarding message because filter for '${category}' is disabled.`);
      return;
    }

    const bridgeUrl = process.env.NEXT_PUBLIC_WHATSAPP_BRIDGE_URL || 'http://localhost:3001';
    const isLocalBridge = bridgeUrl.includes('localhost') || bridgeUrl.includes('127.0.0.1');

    // Dynamic offline checker & auto-spawner (only run auto-spawner if target bridge is local)
    try {
      await fetch(`${bridgeUrl}/status`, { method: 'GET' });
    } catch (pingErr) {
      if (isLocalBridge) {
        try {
          const lockPath = path.join(process.cwd(), 'whatsapp_spawn.lock');
          if (fs.existsSync(lockPath)) {
            const stat = fs.statSync(lockPath);
            const ageMs = Date.now() - stat.mtimeMs;
            if (ageMs < 15000) {
              logs.push('WhatsApp Bridge was spawned recently. Skipping duplicate spawn.');
              return;
            }
          }
          fs.writeFileSync(lockPath, String(Date.now()), 'utf-8');

          logs.push('WhatsApp Bridge is offline. Spawning background instance with logging...');
          const { spawn } = require('child_process');
          const bridgePath = path.join(process.cwd(), 'whatsapp-bridge.js');
          const logFile = path.join(process.cwd(), 'whatsapp-bridge.log');
          const out = fs.openSync(logFile, 'a');
          
          const child = spawn('node', [bridgePath], {
            detached: true,
            stdio: ['ignore', out, out],
            cwd: process.cwd(),
            shell: true
          });
          child.unref();
          
          // Give the socket connection 1.5 seconds to initialize express server
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (spawnErr: any) {
          logs.push(`Failed to auto-spawn WhatsApp Bridge: ${spawnErr.message}`);
        }
      } else {
        logs.push(`WhatsApp Bridge is offline at remote URL: ${bridgeUrl}. Cannot auto-spawn remote processes.`);
      }
    }

    logs.push(`WhatsApp notifications enabled. Forwarding alert to ${config.whatsapp_recipients.length} recipients...`);
    
    // Convert HTML tags to WhatsApp Markdown
    const waMessage = message
      .replace(/<b>/g, '*').replace(/<\/b>/g, '*')
      .replace(/<code>/g, '`').replace(/<\/code>/g, '`')
      .replace(/<pre>/g, '```').replace(/<\/pre>/g, '```')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]*>/g, ''); // strip remaining tags

    // Post message to all recipients concurrently
    await Promise.all(
      config.whatsapp_recipients.map(async (recipient: string) => {
        try {
          const res = await fetch(`${bridgeUrl}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: recipient, message: waMessage }),
          });
          if (!res.ok) {
            const errData = await res.json();
            logs.push(`Failed to send WhatsApp alert to ${recipient}: ${errData.error || res.statusText}`);
          } else {
            logs.push(`WhatsApp alert successfully sent to ${recipient}.`);
          }
        } catch (err: any) {
          logs.push(`Failed to contact WhatsApp Bridge at ${bridgeUrl} for ${recipient}: ${err.message}`);
        }
      })
    );
  } catch (err: any) {
    logs.push(`Error executing WhatsApp alert forwarder: ${err.message}`);
  }
}

