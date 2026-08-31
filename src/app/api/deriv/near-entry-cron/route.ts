import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import { supabase } from '@/lib/supabase';
import {
  analyzeForex15mStrategy,
  analyzeForex15mStrategyV2,
  analyzeForex30mStrategyV3,
  isAsianSessionBlocked,
  isSpreadBlocked,
  isEconomicNewsBlocked,
  getRiskControlsStatus
} from '@/lib/deriv_strategy';
import {
  fetchOTP,
  fetchCandles,
  fetchTick,
  buyContract,
  sendTelegramAlert,
  saveDerivScanLogs,
  getDisplaySymbolName,
  syncOpenTrades
} from '@/lib/deriv_api_helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const scanLogs: string[] = [];
  let socket: WebSocket | null = null;
  scanLogs.push(`[${new Date().toISOString()}] Starting Deriv Near-Entry 1m Monitor...`);

  // Run 4 iterations spaced 15 seconds apart inside the 1-minute cron window
  const ITERATIONS = 4;
  const TARGET_INTERVAL_MS = 15000;

  // 1. Initial settings check
  let { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (settingsErr || !settings) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }

  let existingOverrides = settings.pair_overrides || {};
  let isBotEnabled = existingOverrides.deriv_bot_enabled !== undefined ? existingOverrides.deriv_bot_enabled : (settings.deriv_bot_enabled || false);

  if (!isBotEnabled) {
    scanLogs.push('⚠️ Monitor inactive: Deriv Bot is disabled.');
    return NextResponse.json({ success: true, message: 'Bot disabled', logs: scanLogs });
  }

  const appId = settings.deriv_app_id || process.env.DERIV_APP_ID || '';
  const token = settings.deriv_api_token || process.env.DERIV_API_TOKEN || '';
  const demoAccount = settings.deriv_demo_account || process.env.DERIV_DEMO_ACCOUNT || '';
  const realAccount = settings.deriv_real_account || process.env.DERIV_REAL_ACCOUNT || '';
  const tradingMode = existingOverrides.deriv_trading_mode || settings.deriv_trading_mode || 'DEMO';
  const activeAccount = tradingMode === 'DEMO' ? demoAccount : realAccount;
  const derivStakeAmount = existingOverrides.deriv_stake_amount || 1.00;

  try {
    // 2. Connect WebSocket via OTP once before the loop to reuse it and optimize connection delay
    const wsUrl = await fetchOTP(appId, token, activeAccount);
    
    const connectAttempts = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= connectAttempts; attempt++) {
      try {
        socket = await new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(wsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            origin: 'https://cryptotradigbot-production.up.railway.app'
          });
          
          ws.on('unexpected-response', (req: any, res: any) => {
            reject(new Error(`Handshake rejected: HTTP ${res.statusCode}`));
          });

          ws.on('open', () => resolve(ws));
          ws.on('error', (e: any) => reject(new Error(e.message || 'WebSocket handshake failed.')));
          setTimeout(() => reject(new Error('Connection timed out.')), 15000);
        });
        break; // Successfully connected!
      } catch (err: any) {
        lastError = err;
        scanLogs.push(`⚠️ WebSocket connection attempt ${attempt} failed: ${err.message}`);
        if (attempt < connectAttempts) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    if (!socket) {
      throw new Error(`WebSocket connection failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    scanLogs.push('✅ Authenticated. Commencing 15-second sub-loop checks...');

    // 3. Commencing sub-loop iterations
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const iterStartTime = Date.now();
      scanLogs.push(`\n[Loop Iteration ${iter + 1}/${ITERATIONS}]`);

      // A. Re-fetch overrides and watchlist to capture real-time manual updates
      const { data: currentSettings } = await supabase
        .from('settings')
        .select('pair_overrides')
        .eq('id', 1)
        .single();

      existingOverrides = currentSettings?.pair_overrides || {};
      const loopBotEnabled = existingOverrides.deriv_bot_enabled !== undefined ? existingOverrides.deriv_bot_enabled : (settings.deriv_bot_enabled || false);
      if (!loopBotEnabled) {
        scanLogs.push('⚠️ Bot was disabled during runtime loop. Exiting loop.');
        break;
      }

      const nearEntryPairs: any[] = existingOverrides.deriv_near_entry_pairs || [];

      // B. Fetch open trades to sync
      const { data: openTrades } = await supabase
        .from('deriv_trades')
        .select('*')
        .eq('status', 'OPEN');
      const openTradesCount = openTrades ? openTrades.length : 0;

      if (nearEntryPairs.length === 0 && openTradesCount === 0) {
        scanLogs.push('ℹ️ No active watchlist pairs or open trades in this check.');
      } else {
        // C. Sync open trades
        if (openTrades && openTrades.length > 0) {
          scanLogs.push(`ℹ️ Syncing ${openTrades.length} open trade(s) on Deriv...`);
          await syncOpenTrades(socket, openTrades);
        }

        // D. Risk Controls Checks
        const riskControls = await getRiskControlsStatus();
        const dailyLimitEnabled = existingOverrides.deriv_daily_limit_enabled !== false;
        const cooldownFilterEnabled = existingOverrides.deriv_cooldown_filter_enabled !== false;

        let skipScan = false;
        if (dailyLimitEnabled && riskControls.isDailyLimitBlocked) {
          scanLogs.push('🚨 Daily profit/loss limit reached. Skipping.');
          skipScan = true;
        }
        if (cooldownFilterEnabled && riskControls.isCooldownBlocked) {
          scanLogs.push('🚨 Cooldown active. Skipping.');
          skipScan = true;
        }

        if (!skipScan && nearEntryPairs.length > 0) {
          const sessionFilterEnabled = existingOverrides.deriv_session_filter_enabled !== false;
          const newsFilterEnabled = existingOverrides.deriv_news_filter_enabled !== false;

          // E. Scan watchlist pairs
          const updatedWatchlist: any[] = [];
          const scanResults: any[] = [];

          for (const watchlistPair of nearEntryPairs) {
            const pair = watchlistPair.symbol;
            const localLogs: string[] = [];
            let executionSuccess = false;
            let stillNear = false;
            let finalNearEntryObj = watchlistPair;

            try {
              localLogs.push(`Scanning ${getDisplaySymbolName(pair)}...`);
              
              // 1. Asian Session Check
              const isSessionBlocked = sessionFilterEnabled ? isAsianSessionBlocked() : false;
              if (isSessionBlocked) {
                localLogs.push(`- Session block active for ${pair}.`);
                scanResults.push({ logs: localLogs, stillNear: true, entryPair: watchlistPair });
                continue;
              }

              // 0. Cooldown Filter based on consecutive losses
              const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
              const { data: recentTrades } = await supabase
                .from('deriv_trades')
                .select('pnl')
                .eq('symbol', pair)
                .gte('closed_at', twoHoursAgo)
                .order('closed_at', { ascending: false });

              if (recentTrades && recentTrades.length >= 2) {
                const lastTwoAreLosses = recentTrades.slice(0, 2).every(t => t.pnl < 0);
                if (lastTwoAreLosses) {
                  localLogs.push(`- Skip: ${pair} has 2 consecutive losses. Locked under cooldown.`);
                  scanResults.push({ logs: localLogs, stillNear: true, entryPair: watchlistPair });
                  continue;
                }
              }


              // 2. Economic News Check
              const newsBlocked = newsFilterEnabled ? await isEconomicNewsBlocked(pair) : false;
              if (newsBlocked) {
                localLogs.push(`- Economic news block active for ${pair}.`);
                scanResults.push({ logs: localLogs, stillNear: true, entryPair: watchlistPair });
                continue;
              }

              // 3. Fetch candles (5m, 15m, 1h)
              const candles5m = await fetchCandles(socket, pair, 300);
              const candles15m = await fetchCandles(socket, pair, 900);
              const candlesH1 = await fetchCandles(socket, pair, 3600);

              const activeStrategies = (existingOverrides.deriv_active_strategies || ['FOREX_15M_MTF']) as string[];

              let candles10m: any[] = [];
              let candles30m: any[] = [];
              let candlesH4: any[] = [];

              if (activeStrategies.includes('FOREX_30M_MTF_V3')) {
                candles10m = await fetchCandles(socket, pair, 600);
                candles30m = await fetchCandles(socket, pair, 1800);
                candlesH4 = await fetchCandles(socket, pair, 14400);
              }

              for (const stratId of activeStrategies) {
                let strategyResultObj;
                let stratName = '';
                let tradeDuration = 15;
                
                if (stratId === 'FOREX_15M_MTF_V2') {
                  strategyResultObj = analyzeForex15mStrategyV2(candles5m, candles15m, candlesH1);
                  stratName = 'v2 - Forex 15m MTF Crossover';
                  tradeDuration = 15;
                } else if (stratId === 'FOREX_30M_MTF_V3') {
                  strategyResultObj = analyzeForex30mStrategyV3(candles10m, candles30m, candlesH1, candlesH4);
                  stratName = 'v1.1 - Forex 30m MTF Crossover';
                  tradeDuration = 30;
                } else {
                  strategyResultObj = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
                  stratName = 'v1 - Forex 15m MTF Crossover';
                  tradeDuration = 15;
                }

                localLogs.push(`- [${stratName}] ADX=${strategyResultObj.adxValue.toFixed(1)} | Direction=${strategyResultObj.direction}`);

                if (strategyResultObj.direction !== 'NEUTRAL') {
                  // Crossover Triggered!
                  const tick = await fetchTick(socket, pair);
                  if (tick) {
                    const spreadBlocked = isSpreadBlocked(pair, tick.ask, tick.bid);
                    if (spreadBlocked) {
                      localLogs.push(`- [${stratName}] Skip: Spread exceeds limit.`);
                      continue;
                    }

                    localLogs.push(`🔥 [${stratName}] Trigger! Buying $${derivStakeAmount.toFixed(2)} ${strategyResultObj.direction} contract.`);
                    try {
                      const result = await buyContract(socket, pair, strategyResultObj.direction, derivStakeAmount, tradeDuration);
                      executionSuccess = true;
                      
                      const newTrade = {
                        id: crypto.randomUUID(),
                        contract_id: result.contract_id,
                        symbol: pair,
                        contract_type: strategyResultObj.direction,
                        duration: tradeDuration,
                        duration_unit: 'm',
                        stake: derivStakeAmount,
                        payout: parseFloat(result.payout),
                        status: 'OPEN',
                        entry_price: parseFloat(result.buy_price),
                        exit_price: null,
                        barrier: null,
                        pnl: 0,
                        is_paper: tradingMode === 'DEMO',
                        created_at: new Date(result.start_time * 1000).toISOString(),
                        closed_at: null
                      };

                      await supabase.from('deriv_trades').insert([newTrade]);
                      
                      const signalMsg = `🔔 <b>DERIV SIGNAL EXECUTED</b>\n\n` +
                        `Asset: <b>${getDisplaySymbolName(pair)}</b>\n` +
                        `Strategy: <b>${stratName}</b>\n` +
                        `Direction: ${strategyResultObj.direction === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}\n` +
                        `Timeframe: ${tradeDuration}m\n` +
                        `Account: ${tradingMode}\n` +
                        `Stake: $${derivStakeAmount.toFixed(2)}`;
                      
                      await sendTelegramAlert(signalMsg);
                    } catch (buyErr: any) {
                      localLogs.push(`❌ [${stratName}] Buy error: ${buyErr.message}`);
                    }
                  }
                } else if (strategyResultObj.nearEntry.isNear) {
                  stillNear = true;
                  finalNearEntryObj = {
                    symbol: pair,
                    direction: strategyResultObj.nearEntry.direction,
                    reason: `[${stratName}] ${strategyResultObj.nearEntry.reason}`,
                    adx: strategyResultObj.adxValue,
                    stochK: strategyResultObj.nearEntry.stochK,
                    stochD: strategyResultObj.nearEntry.stochD,
                    confirmations: strategyResultObj.nearEntry.confirmations,
                    updatedAt: new Date().toISOString()
                  };
                } else {
                  localLogs.push(`- [${stratName}] Not near entry.`);
                }
              }
            } catch (err: any) {
              localLogs.push(`❌ Error scanning ${pair}: ${err.message}`);
              stillNear = true;
            }

            scanResults.push({
              logs: localLogs,
              stillNear: stillNear && !executionSuccess,
              entryPair: finalNearEntryObj
            });
            await new Promise(r => setTimeout(r, 45));
          }

          // F. Consolidate results and save logs
          const currentWatchlist: any[] = [];
          for (const r of scanResults) {
            scanLogs.push(...r.logs);
            if (r.stillNear && r.entryPair) {
              currentWatchlist.push(r.entryPair);
            }
          }
          await saveDerivScanLogs(existingOverrides, scanLogs, currentWatchlist);
        }
      }

      // Calculate elapsed time and dynamic sleep offset to hit exactly 15 seconds
      const elapsed = Date.now() - iterStartTime;
      const sleepTime = Math.max(100, TARGET_INTERVAL_MS - elapsed);
      scanLogs.push(`Loop iteration completed in ${elapsed}ms. Sleeping ${sleepTime}ms...`);
      
      if (iter < ITERATIONS - 1) {
        await new Promise(r => setTimeout(r, sleepTime));
      }
    }

    try { socket.close(); } catch (e) {}
    scanLogs.push('Near-Entry monitor execution loop complete.');
    return NextResponse.json({ success: true, logs: scanLogs });

  } catch (err: any) {
    if (socket) {
      try { socket.close(); } catch (e) {}
    }
    scanLogs.push(`❌ Monitor Error: ${err.message}`);
    await saveDerivScanLogs(existingOverrides, scanLogs);
    return NextResponse.json({ error: err.message, logs: scanLogs }, { status: 500 });
  }
}
