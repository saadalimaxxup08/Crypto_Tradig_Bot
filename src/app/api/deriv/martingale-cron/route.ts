import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import { supabase } from '@/lib/supabase';
import {
  analyzeForex15mStrategy,
  analyzeForex15mStrategyV2,
  analyzeForex30mStrategyV3,
  analyzeForex15mProV1Strategy,
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

import {
  getMartingaleExecutionStake,
  DEFAULT_MARTINGALE_CONFIG,
  MartingaleConfig
} from '@/lib/deriv_martingale_engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const scanLogs: string[] = [];
  let socket: WebSocket | null = null;

  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (!settings) {
      return NextResponse.json({ success: false, error: 'Database settings row missing.' }, { status: 500 });
    }

    const ov = settings.pair_overrides || {};

    // Atomic Concurrency Lock: Block parallel/duplicate scan requests within 12 seconds
    const lastScanStartedAt = ov.martingale_scan_started_at ? new Date(ov.martingale_scan_started_at).getTime() : 0;
    const nowMs = Date.now();
    if (nowMs - lastScanStartedAt < 12000) {
      scanLogs.push('⏳ Concurrent scan request blocked by Execution Lock (Scan already running).');
      return NextResponse.json({ success: true, message: 'Scan already running', logs: scanLogs });
    }

    // Claim atomic scan lock in DB
    await supabase.from('settings').update({
      pair_overrides: {
        ...ov,
        martingale_scan_started_at: new Date().toISOString()
      }
    }).eq('id', 1);

    const config: MartingaleConfig = settings.martingale_config || {
      enabled: ov.deriv_progression_enabled === true,
      allocated_capital: ov.martingale_allocated_capital || 20.00,
      execution_mode: ov.martingale_execution_mode || 'ONE_BY_ONE',
      selected_pairs: ov.martingale_selected_pairs || DEFAULT_MARTINGALE_CONFIG.selected_pairs,
      progression_steps: ov.deriv_progression_steps || DEFAULT_MARTINGALE_CONFIG.progression_steps,
      progression_active_steps: ov.deriv_progression_active_steps || DEFAULT_MARTINGALE_CONFIG.progression_active_steps
    };

    if (!config.enabled) {
      scanLogs.push('⚠️ Martingale Strategy Engine is set to WORK OFF.');
      return NextResponse.json({ success: true, message: 'Martingale Strategy Engine inactive', logs: scanLogs });
    }

    const selectedPairs = config.selected_pairs || DEFAULT_MARTINGALE_CONFIG.selected_pairs;
    if (selectedPairs.length === 0) {
      scanLogs.push('⚠️ No pairs selected for Martingale Engine.');
      return NextResponse.json({ success: true, message: 'No selected pairs', logs: scanLogs });
    }

    const appId = settings.deriv_app_id || process.env.DERIV_APP_ID || '';
    const token = settings.deriv_api_token || process.env.DERIV_API_TOKEN || '';
    const demoAccount = settings.deriv_demo_account || process.env.DERIV_DEMO_ACCOUNT || '';
    const realAccount = settings.deriv_real_account || process.env.DERIV_REAL_ACCOUNT || '';
    
    // Read independent Martingale trading account mode (DEMO vs REAL)
    const tradingMode = ov.martingale_trading_mode || ov.deriv_trading_mode || 'DEMO';
    const activeAccount = tradingMode === 'DEMO' ? demoAccount : realAccount;

    if (!appId || !token || !activeAccount) {
      scanLogs.push(`❌ Missing Deriv credentials or active account (${tradingMode} ID)`);
      return NextResponse.json({ success: true, message: 'Missing credentials', logs: scanLogs });
    }

    // Load risk filter toggles
    const newsFilterEnabled = ov.deriv_news_filter_enabled !== false;
    const sessionFilterEnabled = ov.deriv_session_filter_enabled !== false;
    const cooldownFilterEnabled = ov.deriv_cooldown_filter_enabled !== false;
    const dailyLimitEnabled = ov.deriv_daily_limit_enabled !== false;
    const pairLossCooldownEnabled = ov.deriv_pair_loss_cooldown_enabled !== false;
    const pairRotationGuardEnabled = ov.deriv_pair_rotation_guard_enabled !== false;

    if (sessionFilterEnabled && isAsianSessionBlocked()) {
      scanLogs.push('⏳ Session Filter: Asian session block active (21:00 - 23:59 GMT). Skipping Martingale scans.');
      return NextResponse.json({ success: true, message: 'Asian session block', logs: scanLogs });
    }

    const riskControls = await getRiskControlsStatus();
    if (dailyLimitEnabled && riskControls.isDailyLimitBlocked) {
      scanLogs.push(`🚨 Risk Control: Daily limit of 10 trades reached (${riskControls.dailyTradesCount} trades today). Skipping Martingale scans.`);
      return NextResponse.json({ success: true, message: 'Daily limit reached', logs: scanLogs });
    }
    if (cooldownFilterEnabled && riskControls.isCooldownBlocked) {
      scanLogs.push('🚨 Risk Control: 2 consecutive losses detected. Cooldown period (60m) active. Skipping Martingale scans.');
      return NextResponse.json({ success: true, message: 'Cooldown active', logs: scanLogs });
    }

    // Check stake and ONE_BY_ONE lock before opening WS
    const stakeResult = await getMartingaleExecutionStake(config);
    if (stakeResult.isHalted) {
      scanLogs.push(stakeResult.haltReason || 'Martingale Engine Halted.');
      return NextResponse.json({ success: true, message: 'Halted', logs: scanLogs });
    }
    if (stakeResult.isOpenBlocked) {
      scanLogs.push(stakeResult.haltReason || 'Martingale One-by-One Lock Active.');
      return NextResponse.json({ success: true, message: 'One-by-One Lock Active', logs: scanLogs });
    }

    // Connect WebSocket via OTP to ensure authorized options trading session
    const wsUrl = await fetchOTP(appId, token, activeAccount);
    
    const connectAttempts = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= connectAttempts; attempt++) {
      try {
        socket = await new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(wsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          ws.on('unexpected-response', (req: any, res: any) => reject(new Error(`Handshake rejected: HTTP ${res.statusCode}`)));
          ws.on('open', () => resolve(ws));
          ws.on('error', (e: any) => reject(new Error(e.message || 'WebSocket handshake failed.')));
          setTimeout(() => reject(new Error('Connection timed out.')), 15000);
        });
        break;
      } catch (err: any) {
        lastError = err;
        scanLogs.push(`⚠️ WebSocket connection attempt ${attempt} failed: ${err.message}`);
        if (attempt < connectAttempts) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    if (!socket) {
      throw new Error(`WebSocket connection failed: ${lastError?.message}`);
    }

    (socket as any).setMaxListeners?.(200);

    // Sync open Martingale trades
    const { data: openTrades } = await supabase
      .from('deriv_trades')
      .select('*')
      .neq('stake', 1.00)
      .eq('status', 'OPEN');

    if (openTrades && openTrades.length > 0) {
      await syncOpenTrades(socket, openTrades);
    }

    // Re-verify ONE_BY_ONE lock after sync
    if (config.execution_mode === 'ONE_BY_ONE') {
      const { data: stillOpen } = await supabase
        .from('deriv_trades')
        .select('*')
        .neq('stake', 1.00)
        .eq('status', 'OPEN');

      if (stillOpen && stillOpen.length > 0) {
        scanLogs.push(`⏳ [One-by-One Mode] Open contract active on ${getDisplaySymbolName(stillOpen[0].symbol)}. Waiting for expiry.`);
        socket.close();
        return NextResponse.json({ success: true, message: 'One-by-one active trade running', logs: scanLogs });
      }
    }

    // Re-calculate effective stake after sync
    const freshStakeResult = await getMartingaleExecutionStake(config);
    if (freshStakeResult.isHalted || freshStakeResult.stake <= 0) {
      scanLogs.push(freshStakeResult.haltReason || 'Martingale Halted.');
      socket.close();
      return NextResponse.json({ success: true, message: 'Halted after sync', logs: scanLogs });
    }

    const effectiveStake = freshStakeResult.stake;
    scanLogs.push(`📊 [Martingale Engine] Step ${freshStakeResult.stepIndex + 1} Stake: $${effectiveStake.toFixed(2)} | Account: ${tradingMode} | Mode: ${config.execution_mode}`);

    const nearEntryPairs: any[] = [];
    const activeStrategies = (ov.martingale_active_strategies || ov.deriv_active_strategies || ['FOREX_15M_PRO_V1', 'FOREX_15M_MTF', 'FOREX_15M_MTF_V2', 'FOREX_30M_MTF_V3']) as string[];

    // Scan pairs for entry using active strategy models
    for (const pair of selectedPairs) {
      if (newsFilterEnabled && await isEconomicNewsBlocked(pair)) {
        scanLogs.push(`- Skip ${getDisplaySymbolName(pair)}: High Impact News block is active.`);
        continue;
      }

      if (pairLossCooldownEnabled) {
        const { data: lastPairTrade } = await supabase
          .from('deriv_trades')
          .select('status, closed_at, created_at')
          .eq('symbol', pair)
          .neq('stake', 1.00)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastPairTrade && lastPairTrade.status === 'LOST') {
          const closedTime = new Date(lastPairTrade.closed_at || lastPairTrade.created_at).getTime();
          const elapsedMins = (Date.now() - closedTime) / (1000 * 60);
          if (elapsedMins < 60) {
            scanLogs.push(`- Skip ${getDisplaySymbolName(pair)}: Post-loss 1-hour pair cooldown active (${Math.round(60 - elapsedMins)}m remaining).`);
            continue;
          }
        }
      }

      if (pairRotationGuardEnabled) {
        const { data: lastGlobalTrade } = await supabase
          .from('deriv_trades')
          .select('symbol, status')
          .neq('stake', 1.00)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastGlobalTrade && lastGlobalTrade.symbol === pair && lastGlobalTrade.status === 'LOST') {
          scanLogs.push(`- Skip ${getDisplaySymbolName(pair)}: Pair Rotation Guard active (waiting for another pair to trade after loss).`);
          continue;
        }
      }

      scanLogs.push(`Scanning ${getDisplaySymbolName(pair)}...`);

      const candles5m = await fetchCandles(socket, pair, 300, appId);
      const candles15m = await fetchCandles(socket, pair, 900, appId);
      const candlesH1 = await fetchCandles(socket, pair, 3600, appId);

      let candles10m: any[] = [];
      let candles30m: any[] = [];
      let candlesH4: any[] = [];

      if (activeStrategies.includes('FOREX_30M_MTF_V3')) {
        candles10m = await fetchCandles(socket, pair, 600, appId);
        candles30m = await fetchCandles(socket, pair, 1800, appId);
        candlesH4 = await fetchCandles(socket, pair, 14400, appId);
      }

      for (const stratId of activeStrategies) {
        let stratResult: any;
        let stratName = '';
        let tradeDuration = 15;

        if (stratId === 'FOREX_15M_PRO_V1') {
          stratResult = analyzeForex15mProV1Strategy(candlesH1, candles15m, candles5m);
          stratName = 'v1 - Forex 15m Trend-Rejection Pro';
          tradeDuration = 15;
        } else if (stratId === 'FOREX_15M_MTF_V2') {
          stratResult = analyzeForex15mStrategyV2(candles5m, candles15m, candlesH1);
          stratName = 'v2 - Forex 15m MTF Crossover';
          tradeDuration = 15;
        } else if (stratId === 'FOREX_30M_MTF_V3') {
          stratResult = analyzeForex30mStrategyV3(candles10m, candles30m, candlesH1, candlesH4);
          stratName = 'v1.1 - Forex 30m MTF Crossover';
          tradeDuration = 30;
        } else {
          stratResult = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
          stratName = 'v1 - Forex 15m MTF Crossover';
          tradeDuration = 15;
        }

        scanLogs.push(`- [${stratName}] ADX: ${stratResult.adxValue.toFixed(1)} | Signal: ${stratResult.direction}`);

        nearEntryPairs.push({
          symbol: pair,
          direction: stratResult.direction === 'CALL' ? 'RISE' : stratResult.direction === 'PUT' ? 'FALL' : (stratResult.nearEntry?.direction || 'ANALYZING'),
          reason: stratResult.direction !== 'NEUTRAL' ? `Signal ${stratResult.direction} Triggered` : (stratResult.nearEntry?.reason || `ADX: ${stratResult.adxValue.toFixed(1)} | Monitoring Crossover`),
          confirmations: stratResult.nearEntry?.confirmations || {
            trend: stratResult.adxValue >= 20,
            adx: stratResult.adxValue >= 22,
            stochZone: true
          },
          adx: stratResult.adxValue || 0,
          stochK: stratResult.nearEntry?.stochK || 50,
          stochD: stratResult.nearEntry?.stochD || 50,
          updatedAt: new Date().toISOString()
        });

        if (stratResult.direction !== 'NEUTRAL') {
          // Re-verify ONE_BY_ONE lock in DB right before buying contract
          if (config.execution_mode === 'ONE_BY_ONE') {
            const { data: currentOpen } = await supabase
              .from('deriv_trades')
              .select('id')
              .neq('stake', 1.00)
              .eq('status', 'OPEN');

            if (currentOpen && currentOpen.length > 0) {
              scanLogs.push(`🔒 [One-By-One Safety Lock] Open contract active. Halting execution on ${getDisplaySymbolName(pair)}.`);
              break;
            }
          }

          const tick = await fetchTick(socket, pair);
          if (tick) {
            if (isSpreadBlocked(pair, tick.ask, tick.bid)) {
              scanLogs.push(`- Skip ${getDisplaySymbolName(pair)}: Spread limit exceeded.`);
              continue;
            }

            scanLogs.push(`🔥 [Martingale Engine] Triggering $${effectiveStake.toFixed(2)} ${stratResult.direction} on ${getDisplaySymbolName(pair)}`);
            try {
              const result = await buyContract(socket, pair, stratResult.direction, effectiveStake, tradeDuration);
              
              const newTrade = {
                id: crypto.randomUUID(),
                contract_id: result.contract_id,
                symbol: pair,
                contract_type: stratResult.direction,
                duration: tradeDuration,
                duration_unit: 'm',
                stake: effectiveStake,
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
              scanLogs.push(`🎉 Martingale Trade Executed! ID: ${result.contract_id}`);

              // Send Telegram Alert
              const chartLink = `https://dtrader.deriv.com/?chart_type=candle&interval=5m&symbol=${pair}&trade_type=rise_fall`;
              const signalMsg = `🚀 <b>MARTINGALE ENGINE ALERT</b> 🚀\n` +
                `-------------------------------------\n` +
                `<b>Asset Pair:</b> ${getDisplaySymbolName(pair)}\n` +
                `<b>Progression Step:</b> Step ${freshStakeResult.stepIndex + 1}\n` +
                `<b>Stake Amount:</b> $${effectiveStake.toFixed(2)}\n` +
                `<b>Direction:</b> ${stratResult.direction === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}\n` +
                `<b>Execution Mode:</b> ${config.execution_mode === 'ONE_BY_ONE' ? 'One-By-One (Sequential)' : 'Multi-Trade'}\n` +
                `<b>Account:</b> ${tradingMode}\n\n` +
                `📈 <a href="${chartLink}">Open Live Chart on Deriv</a>`;

              await sendTelegramAlert(signalMsg);

              // If ONE_BY_ONE mode, stop scanning remaining pairs once trade is placed!
              if (config.execution_mode === 'ONE_BY_ONE') {
                scanLogs.push('🔒 One-by-One trade executed. Halting further pair scans in this cycle.');
                break;
              }
            } catch (buyErr: any) {
              scanLogs.push(`❌ Buy error on ${getDisplaySymbolName(pair)}: ${buyErr.message}`);
            }
          }
        }
      }

      // If ONE_BY_ONE mode trade placed, break outer pair loop as well
      const { data: checkOpen } = await supabase.from('deriv_trades').select('id').neq('stake', 1.00).eq('status', 'OPEN');
      if (config.execution_mode === 'ONE_BY_ONE' && checkOpen && checkOpen.length > 0) {
        break;
      }
    }

    // Deduplicate and sort nearEntryPairs so highest probability signals rank at the top
    const uniqueNearEntryMap = new Map<string, any>();
    for (const item of nearEntryPairs) {
      const existing = uniqueNearEntryMap.get(item.symbol);
      if (!existing) {
        uniqueNearEntryMap.set(item.symbol, item);
      } else {
        const isNewTriggered = item.direction === 'RISE' || item.direction === 'FALL';
        const isExTriggered = existing.direction === 'RISE' || existing.direction === 'FALL';
        if (isNewTriggered && !isExTriggered) {
          uniqueNearEntryMap.set(item.symbol, item);
        } else if (isNewTriggered === isExTriggered && (item.adx || 0) > (existing.adx || 0)) {
          uniqueNearEntryMap.set(item.symbol, item);
        }
      }
    }

    const sortedNearEntryList = Array.from(uniqueNearEntryMap.values()).sort((a, b) => {
      const aTrig = (a.direction === 'RISE' || a.direction === 'FALL') ? 3 : 0;
      const bTrig = (b.direction === 'RISE' || b.direction === 'FALL') ? 3 : 0;
      
      const scoreA = aTrig + (a.confirmations?.trend ? 1 : 0) + (a.confirmations?.adx ? 1 : 0) + (a.confirmations?.stochZone ? 1 : 0) + ((a.adx || 0) > 0 ? 0.5 : 0);
      const scoreB = bTrig + (b.confirmations?.trend ? 1 : 0) + (b.confirmations?.adx ? 1 : 0) + (b.confirmations?.stochZone ? 1 : 0) + ((b.adx || 0) > 0 ? 0.5 : 0);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return (b.adx || 0) - (a.adx || 0);
    });

    // Save latest near entry pairs & trimmed scan logs to Supabase pair_overrides
    const { data: latestSettings } = await supabase.from('settings').select('pair_overrides').eq('id', 1).single();
    const currentOv = latestSettings?.pair_overrides || {};
    await supabase.from('settings').update({
      pair_overrides: {
        ...currentOv,
        martingale_near_entry_pairs: sortedNearEntryList,
        martingale_last_scan_logs: scanLogs.slice(-25),
        martingale_last_scan_at: new Date().toISOString()
      }
    }).eq('id', 1);

    socket.close();
    return NextResponse.json({ success: true, logs: scanLogs, nearEntryPairs: sortedNearEntryList });
  } catch (err: any) {
    if (socket) socket.close();
    return NextResponse.json({ success: false, error: err.message, logs: scanLogs }, { status: 500 });
  }
}
