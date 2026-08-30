import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import { supabase } from '@/lib/supabase';
import {
  analyzeForex15mStrategy,
  analyzeForex15mStrategyV2,
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

const PAIRS = ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY'];

export async function GET(req: Request) {
  const scanLogs: string[] = [];
  let socket: WebSocket | null = null;
  scanLogs.push(`[${new Date().toISOString()}] Starting Deriv MTF Options Scanner...`);

  // Fetch settings to merge overrides
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (settingsErr) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }

  const existingOverrides = settings.pair_overrides || {};
  const derivStakeAmount = existingOverrides.deriv_stake_amount || 1.00;

  try {
    const isBotEnabled = existingOverrides.deriv_bot_enabled !== undefined ? existingOverrides.deriv_bot_enabled : (settings.deriv_bot_enabled || false);
    const tradingMode = existingOverrides.deriv_trading_mode || settings.deriv_trading_mode || 'DEMO';
    const appId = settings.deriv_app_id || process.env.DERIV_APP_ID || '';
    const token = settings.deriv_api_token || process.env.DERIV_API_TOKEN || '';
    const demoAccount = settings.deriv_demo_account || process.env.DERIV_DEMO_ACCOUNT || '';
    const realAccount = settings.deriv_real_account || process.env.DERIV_REAL_ACCOUNT || '';

    scanLogs.push(`[Config Check] Active App ID: ${appId}`);
    scanLogs.push(`[Config Check] Active Token: ${token ? (token.slice(0, 6) + '...' + token.slice(-4)) : 'None'}`);

    if (!isBotEnabled) {
      scanLogs.push('⚠️ Scanner inactive: Deriv Bot is set to WORK OFF in settings.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Bot disabled', logs: scanLogs });
    }

    const activeStrategies = (existingOverrides.deriv_active_strategies || ['FOREX_15M_MTF']) as string[];
    const hasAnyActiveStrategy = activeStrategies.includes('FOREX_15M_MTF') || activeStrategies.includes('FOREX_15M_MTF_V2');
    if (!hasAnyActiveStrategy) {
      scanLogs.push('⚠️ Scanner inactive: No strategy engine (v1 or v2) is ticked (enabled) on the Deriv dashboard.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'No active strategy enabled', logs: scanLogs });
    }

    const activeAccount = tradingMode === 'DEMO' ? demoAccount : realAccount;
    if (!appId || !token || !activeAccount) {
      scanLogs.push('❌ Error: Missing Deriv credentials or active account configuration.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Missing credentials', logs: scanLogs });
    }

    // Load risk toggles (defaults to true)
    const newsFilterEnabled = existingOverrides.deriv_news_filter_enabled !== false;
    const sessionFilterEnabled = existingOverrides.deriv_session_filter_enabled !== false;
    const cooldownFilterEnabled = existingOverrides.deriv_cooldown_filter_enabled !== false;
    const dailyLimitEnabled = existingOverrides.deriv_daily_limit_enabled !== false;

    // 2. Filter: Session Check
    if (sessionFilterEnabled && isAsianSessionBlocked()) {
      scanLogs.push('⏳ Session Filter: Asian session block active (21:00 - 23:59 GMT). Skipping trade scans.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Asian session block', logs: scanLogs });
    }

    // 3. Filter: Risk Controls Check
    const derivMaxTrades = existingOverrides.deriv_max_trades || 10;
    const { data: openTrades, error: countErr } = await supabase
      .from('deriv_trades')
      .select('*')
      .eq('status', 'OPEN');

    const openTradesCount = openTrades ? openTrades.length : 0;

    if (!countErr && openTradesCount >= derivMaxTrades) {
      scanLogs.push(`⚠️ Halted execution: Open trades count (${openTradesCount}) reached the maximum limit of ${derivMaxTrades}. Skipping.`);
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Max trades limit reached', logs: scanLogs });
    }

    const riskControls = await getRiskControlsStatus();
    if (dailyLimitEnabled && riskControls.isDailyLimitBlocked) {
      scanLogs.push(`🚨 Risk Control: Daily limit of 10 trades reached (${riskControls.dailyTradesCount} trades today). Skipping.`);
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Daily limit reached', logs: scanLogs });
    }
    if (cooldownFilterEnabled && riskControls.isCooldownBlocked) {
      scanLogs.push('🚨 Risk Control: 2 consecutive losses detected. Cooldown period (60m) active. Skipping.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Cooldown active', logs: scanLogs });
    }

    // 4. Connect WebSocket using OTP endpoint with robust retry logic
    const wsUrl = await fetchOTP(appId, token, activeAccount);
    
    const host = req.headers.get('host') || 'cryptotradigbot-production.up.railway.app';
    const protocol = host.includes('localhost') ? 'http:' : 'https:';
    const originUrl = `${protocol}//${host}`;

    const connectAttempts = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= connectAttempts; attempt++) {
      try {
        socket = await new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(wsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            origin: originUrl
          });
          
          ws.on('unexpected-response', (req: any, res: any) => {
            reject(new Error(`Handshake rejected: HTTP ${res.statusCode} | CF-Ray: ${res.headers['cf-ray'] || 'None'}`));
          });

          ws.on('open', () => resolve(ws));
          ws.on('error', (e: any) => reject(new Error(e.message || 'WebSocket handshake failed.')));
          // 15 seconds timeout for serverless environments
          setTimeout(() => reject(new Error('Connection timed out.')), 15000);
        });
        break; // Successfully connected!
      } catch (err: any) {
        lastError = err;
        scanLogs.push(`⚠️ WebSocket connection attempt ${attempt} failed: ${err.message}`);
        if (attempt < connectAttempts) {
          // Wait 1.5 seconds before retrying
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    if (!socket) {
      throw new Error(`WebSocket connection failed after ${connectAttempts} attempts. Last error: ${lastError?.message}`);
    }

    // Increase WebSocket MaxListeners to avoid warnings during parallel scans
    (socket as any).setMaxListeners?.(200);

    // Sync any open trades on the backend and alert Telegram on close
    if (openTrades && openTrades.length > 0) {
      scanLogs.push(`ℹ️ Syncing ${openTrades.length} open trade(s) on the backend...`);
      await syncOpenTrades(socket, openTrades);
    }

    const pairsToTrade = existingOverrides.deriv_selected_pairs || ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY'];
    scanLogs.push(`✅ Authenticated. Running scans on pairs: ${pairsToTrade.join(', ')}`);

    const scanResults: any[] = [];
    for (const pair of pairsToTrade) {
      const localLogs: string[] = [`Scanning ${getDisplaySymbolName(pair)}...`];
      let nearEntryObj: any = null;
      try {
        // A. Check if trade already open for this symbol (Max 1 active trade per pair)
        const { data: openTrades, error: checkErr } = await supabase
          .from('deriv_trades')
          .select('*')
          .eq('symbol', pair)
          .eq('status', 'OPEN');

        if (!checkErr && openTrades && openTrades.length > 0) {
          localLogs.push(`- Skip: A contract is already open for ${pair}.`);
          scanResults.push({ logs: localLogs, nearEntry: null });
          continue;
        }

        // B. Filter: Economic News Block
        const newsBlocked = newsFilterEnabled ? await isEconomicNewsBlocked(pair) : false;
        if (newsBlocked) {
          localLogs.push(`- Skip: High Impact News block is active for currencies in ${pair}.`);
          scanResults.push({ logs: localLogs, nearEntry: null });
          continue;
        }

        // C. Fetch Multi-Timeframe Candles
        const candles5m = await fetchCandles(socket!, pair, 300);
        const candles15m = await fetchCandles(socket!, pair, 900);
        const candlesH1 = await fetchCandles(socket!, pair, 3600);

        const strategyResult = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
        
        for (const stratId of activeStrategies) {
          let strategyResultObj;
          let stratName = '';
          
          if (stratId === 'FOREX_15M_MTF_V2') {
            strategyResultObj = analyzeForex15mStrategyV2(candles5m, candles15m, candlesH1);
            stratName = 'Forex 15m MTF Crossover v2';
          } else {
            strategyResultObj = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
            stratName = 'Forex 15m MTF Crossover v1';
          }

          localLogs.push(`- [${stratName}] ADX: ${strategyResultObj.adxValue.toFixed(1)} | Signal: ${strategyResultObj.direction}`);

          if (strategyResultObj.nearEntry.isNear) {
            nearEntryObj = {
              symbol: pair,
              direction: strategyResultObj.nearEntry.direction,
              reason: `[${stratName}] ${strategyResultObj.nearEntry.reason}`,
              adx: strategyResultObj.adxValue,
              stochK: strategyResultObj.nearEntry.stochK,
              stochD: strategyResultObj.nearEntry.stochD,
              confirmations: strategyResultObj.nearEntry.confirmations,
              updatedAt: new Date().toISOString()
            };
          }

          if (strategyResultObj.direction !== 'NEUTRAL') {
            // D. Fetch tick to check spread before buying
            const tick = await fetchTick(socket!, pair);
            if (tick) {
              const spreadBlocked = isSpreadBlocked(pair, tick.ask, tick.bid);
              if (spreadBlocked) {
                localLogs.push(`- [${stratName}] Skip: Spread of ${pair} exceeds 2.0 pips.`);
                continue;
              }

              // E. Execute Trade!
              localLogs.push(`🔥 [${stratName}] Trigger: Placing $${derivStakeAmount.toFixed(2)} ${strategyResultObj.direction} contract on ${pair} with 15m expiry.`);
              try {
                const result = await buyContract(socket!, pair, strategyResultObj.direction, derivStakeAmount);
                
                const newTrade = {
                  id: crypto.randomUUID(),
                  contract_id: result.contract_id,
                  symbol: pair,
                  contract_type: strategyResultObj.direction,
                  duration: 15,
                  duration_unit: 'm',
                  stake: derivStakeAmount,
                  payout: parseFloat(result.payout),
                  status: 'OPEN',
                  entry_price: parseFloat(result.buy_price),
                  exit_price: null,
                  barrier: null,
                  pnl: 0,
                  is_paper: tradingMode === 'DEMO',
                  created_at: new Date().toISOString(),
                  closed_at: null
                };

                await supabase.from('deriv_trades').insert([newTrade]);
                localLogs.push(`🎉 [${stratName}] Trade executed successfully! Contract ID: ${result.contract_id}`);

                // Send Telegram Signal Notification
                const gmtTime = new Date().toUTCString();
                const signalMsg = `🚀 <b>DERIV OP-BOT SIGNAL ALERT</b> 🚀\n` +
                  `-------------------------------------\n` +
                  `<b>Asset Pair:</b> ${getDisplaySymbolName(pair)}\n` +
                  `<b>Strategy:</b> ${stratName}\n` +
                  `<b>Option Direction:</b> ${strategyResultObj.direction === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}\n` +
                  `<b>Entry Price:</b> $${result.buy_price}\n` +
                  `<b>Contract Expiry:</b> 15 Minutes\n` +
                  `<b>Scan Time (GMT):</b> ${gmtTime}\n` +
                  `<b>Analysis Stats:</b> H1 Trend: ${strategyResultObj.direction === 'CALL' ? 'BULLISH' : 'BEARISH'} | ADX: ${strategyResultObj.adxValue.toFixed(1)}\n` +
                  `<b>Account Mode:</b> ${tradingMode} Sandbox`;
                
                await sendTelegramAlert(signalMsg);

              } catch (execErr: any) {
                localLogs.push(`❌ [${stratName}] Purchase execution error for ${pair}: ${execErr.message}`);
              }
            } else {
              localLogs.push(`❌ [${stratName}] Error fetching ticks/spread for ${pair}. Skipping.`);
            }
          }
        }
      } catch (err: any) {
        localLogs.push(`❌ Error processing ${pair}: ${err.message}`);
      }
      scanResults.push({ logs: localLogs, nearEntry: nearEntryObj });
      // Add a small 40ms breather between pairs to protect Deriv rate limits
      await new Promise(r => setTimeout(r, 40));
    }
    const nearEntryPairs: any[] = [];
    for (const r of scanResults) {
      scanLogs.push(...r.logs);
      if (r.nearEntry) {
        nearEntryPairs.push(r.nearEntry);
      }
    }

    socket.close();
    scanLogs.push('Scan loop execution complete.');
    await saveDerivScanLogs(existingOverrides, scanLogs, nearEntryPairs);
    return NextResponse.json({ success: true, logs: scanLogs });

  } catch (err: any) {
    if (socket) {
      try { socket.close(); } catch (e) {}
    }
    scanLogs.push(`❌ System Error occurred: ${err.message}`);
    await saveDerivScanLogs(existingOverrides, scanLogs);
    return NextResponse.json({ error: err.message, logs: scanLogs }, { status: 500 });
  }
}
