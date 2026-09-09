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
    const tradingMode = ov.deriv_trading_mode || settings.deriv_trading_mode || 'DEMO';

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

    // Connect WebSocket
    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId || '68202'}`;
    socket = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      ws.on('open', () => resolve(ws));
      ws.on('error', (e) => reject(e));
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    if (token) {
      await new Promise<void>((resolve) => {
        const authHandler = (evt: any) => {
          const res = JSON.parse(evt.data);
          if (res.msg_type === 'authorize') {
            socket!.removeEventListener('message', authHandler);
            resolve();
          }
        };
        socket!.addEventListener('message', authHandler);
        socket!.send(JSON.stringify({ authorize: token }));
        setTimeout(resolve, 3000);
      });
    }

    // Sync open Martingale trades
    const { data: openTrades } = await supabase
      .from('deriv_trades')
      .select('*')
      .eq('strategy_engine', 'MARTINGALE_ENGINE')
      .eq('status', 'OPEN');

    if (openTrades && openTrades.length > 0) {
      await syncOpenTrades(socket, openTrades);
    }

    // Re-verify ONE_BY_ONE lock after sync
    if (config.execution_mode === 'ONE_BY_ONE') {
      const { data: stillOpen } = await supabase
        .from('deriv_trades')
        .select('*')
        .eq('strategy_engine', 'MARTINGALE_ENGINE')
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
    scanLogs.push(`📊 [Martingale Engine] Step ${freshStakeResult.stepIndex + 1} Stake: $${effectiveStake.toFixed(2)} | Mode: ${config.execution_mode}`);

    // Scan pairs for entry
    for (const pair of selectedPairs) {
      scanLogs.push(`Scanning ${getDisplaySymbolName(pair)}...`);

      const candles5m = await fetchCandles(socket, pair, 300);
      const candles15m = await fetchCandles(socket, pair, 900);
      const candlesH1 = await fetchCandles(socket, pair, 3600);

      const stratResult = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
      scanLogs.push(`- ADX: ${stratResult.adxValue.toFixed(1)} | Signal: ${stratResult.direction}`);

      if (stratResult.direction !== 'NEUTRAL') {
        const tick = await fetchTick(socket, pair);
        if (tick) {
          if (isSpreadBlocked(pair, tick.ask, tick.bid)) {
            scanLogs.push(`- Skip ${getDisplaySymbolName(pair)}: Spread limit exceeded.`);
            continue;
          }

          scanLogs.push(`🔥 [Martingale Engine] Triggering $${effectiveStake.toFixed(2)} ${stratResult.direction} on ${getDisplaySymbolName(pair)}`);
          try {
            const result = await buyContract(socket, pair, stratResult.direction, effectiveStake, 15);
            
            const newTrade = {
              id: crypto.randomUUID(),
              contract_id: result.contract_id,
              symbol: pair,
              contract_type: stratResult.direction,
              duration: 15,
              duration_unit: 'm',
              stake: effectiveStake,
              payout: parseFloat(result.payout),
              status: 'OPEN',
              entry_price: parseFloat(result.buy_price),
              exit_price: null,
              barrier: null,
              pnl: 0,
              is_paper: tradingMode === 'DEMO',
              strategy_engine: 'MARTINGALE_ENGINE',
              created_at: new Date().toISOString(),
              closed_at: null
            };

            await supabase.from('deriv_trades').insert([newTrade]);
            scanLogs.push(`🎉 Martingale Trade Executed! ID: ${result.contract_id}`);

            // Send Telegram & WhatsApp Notification
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

    socket.close();
    return NextResponse.json({ success: true, logs: scanLogs });
  } catch (err: any) {
    if (socket) socket.close();
    return NextResponse.json({ success: false, error: err.message, logs: scanLogs }, { status: 500 });
  }
}
