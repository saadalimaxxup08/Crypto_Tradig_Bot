import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import { supabase } from '@/lib/supabase';
import {
  analyzeForex15mStrategy,
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
  saveDerivScanLogs
} from '@/lib/deriv_api_helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const scanLogs: string[] = [];
  let socket: WebSocket | null = null;
  scanLogs.push(`[${new Date().toISOString()}] Starting Deriv Near-Entry 1m Monitor...`);

  // 1. Fetch settings from database
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (settingsErr) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }

  const existingOverrides = settings.pair_overrides || {};
  const isBotEnabled = existingOverrides.deriv_bot_enabled !== undefined ? existingOverrides.deriv_bot_enabled : (settings.deriv_bot_enabled || false);
  const nearEntryPairs: any[] = existingOverrides.deriv_near_entry_pairs || [];

  if (!isBotEnabled) {
    scanLogs.push('⚠️ Monitor inactive: Deriv Bot is disabled.');
    return NextResponse.json({ success: true, message: 'Bot disabled', logs: scanLogs });
  }

  if (nearEntryPairs.length === 0) {
    scanLogs.push('ℹ️ Monitor exit: No pairs currently in Near-Entry Watchlist.');
    return NextResponse.json({ success: true, message: 'No pairs to monitor', logs: scanLogs });
  }

  const appId = settings.deriv_app_id || process.env.DERIV_APP_ID || '';
  const token = settings.deriv_api_token || process.env.DERIV_API_TOKEN || '';
  const demoAccount = settings.deriv_demo_account || process.env.DERIV_DEMO_ACCOUNT || '';
  const realAccount = settings.deriv_real_account || process.env.DERIV_REAL_ACCOUNT || '';
  const tradingMode = existingOverrides.deriv_trading_mode || settings.deriv_trading_mode || 'DEMO';
  const activeAccount = tradingMode === 'DEMO' ? demoAccount : realAccount;
  const derivStakeAmount = existingOverrides.deriv_stake_amount || 1.00;

  scanLogs.push(`ℹ️ Watchlist has ${nearEntryPairs.length} pair(s) to monitor: ${nearEntryPairs.map(p => p.symbol).join(', ')}`);

  try {
    // 2. Connect WebSocket via OTP (pre-authorized!)
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

    scanLogs.push('✅ Authenticated. Monitoring watchlist pairs...');

    // 3. Risk Controls Checks
    const riskControls = await getRiskControlsStatus();
    const dailyLimitEnabled = existingOverrides.deriv_daily_limit_enabled !== false;
    const cooldownFilterEnabled = existingOverrides.deriv_cooldown_filter_enabled !== false;

    if (dailyLimitEnabled && riskControls.isDailyLimitBlocked) {
      scanLogs.push('🚨 Risk Control: Daily profit target or loss limit reached. Skipping.');
      socket.close();
      return NextResponse.json({ success: true, message: 'Daily limit reached', logs: scanLogs });
    }
    if (cooldownFilterEnabled && riskControls.isCooldownBlocked) {
      scanLogs.push('🚨 Risk Control: Cooldown period active. Skipping.');
      socket.close();
      return NextResponse.json({ success: true, message: 'Cooldown active', logs: scanLogs });
    }

    const sessionFilterEnabled = existingOverrides.deriv_session_filter_enabled !== false;
    const newsFilterEnabled = existingOverrides.deriv_news_filter_enabled !== false;

    // 4. Scan watchlist pairs
    const updatedWatchlist: any[] = [];
    const scanPromises = nearEntryPairs.map(async (watchlistPair) => {
      const pair = watchlistPair.symbol;
      const localLogs: string[] = [];
      let executionSuccess = false;
      let stillNear = false;
      let finalNearEntryObj = watchlistPair;

      try {
        localLogs.push(`Monitoring ${pair}...`);
        
        // A. Asian Session Filter
        const isSessionBlocked = sessionFilterEnabled ? isAsianSessionBlocked() : false;
        if (isSessionBlocked) {
          localLogs.push(`- Skip: Asian Session block is active for ${pair}.`);
          return { logs: localLogs, stillNear: true, entryPair: watchlistPair };
        }

        // B. High Impact News Filter
        const newsBlocked = newsFilterEnabled ? await isEconomicNewsBlocked(pair) : false;
        if (newsBlocked) {
          localLogs.push(`- Skip: High Impact News block is active for ${pair}.`);
          return { logs: localLogs, stillNear: true, entryPair: watchlistPair };
        }

        // C. Fetch candles
        const candles5m = await fetchCandles(socket!, pair, 300);
        const candles15m = await fetchCandles(socket!, pair, 900);
        const candlesH1 = await fetchCandles(socket!, pair, 3600);

        const strategyResult = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
        localLogs.push(`- Watchlist Check: ADX=${strategyResult.adxValue.toFixed(1)} | Direction=${strategyResult.direction}`);

        if (strategyResult.direction !== 'NEUTRAL') {
          // Trigger!
          const tick = await fetchTick(socket!, pair);
          if (tick) {
            const spreadBlocked = isSpreadBlocked(pair, tick.ask, tick.bid);
            if (spreadBlocked) {
              localLogs.push(`- Skip: Spread of ${pair} exceeds limit.`);
              return { logs: localLogs, stillNear: true, entryPair: watchlistPair };
            }

            localLogs.push(`🔥 Entry Triggered! Placing $${derivStakeAmount.toFixed(2)} ${strategyResult.direction} contract on ${pair}.`);
            try {
              const result = await buyContract(socket!, pair, strategyResult.direction, derivStakeAmount);
              executionSuccess = true;
              
              const newTrade = {
                id: crypto.randomUUID(),
                contract_id: result.contract_id,
                symbol: pair,
                contract_type: strategyResult.direction,
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
                created_at: new Date(result.start_time * 1000).toISOString(),
                closed_at: null
              };

              await supabase.from('deriv_trades').insert([newTrade]);
              
              const signalMsg = `🔔 <b>DERIV SIGNAL EXECUTED</b>\n\n` +
                `Asset: <b>${pair}</b>\n` +
                `Direction: ${strategyResult.direction === 'CALL' ? '🟢 BUY' : '🔴 FALL'}\n` +
                `Timeframe: 15m\n` +
                `Account: ${tradingMode}\n` +
                `Stake: $${derivStakeAmount.toFixed(2)}`;
              
              await sendTelegramAlert(signalMsg);
            } catch (buyErr: any) {
              localLogs.push(`❌ Purchase execution error: ${buyErr.message}`);
            }
          }
        } else if (strategyResult.nearEntry.isNear) {
          stillNear = true;
          finalNearEntryObj = {
            symbol: pair,
            direction: strategyResult.nearEntry.direction,
            reason: strategyResult.nearEntry.reason,
            adx: strategyResult.adxValue,
            stochK: strategyResult.nearEntry.stochK,
            stochD: strategyResult.nearEntry.stochD,
            confirmations: strategyResult.nearEntry.confirmations,
            updatedAt: new Date().toISOString()
          };
        } else {
          localLogs.push(`ℹ️ Watchlist: ${pair} is no longer near entry criteria. Removing.`);
        }

      } catch (err: any) {
        localLogs.push(`❌ Error monitoring ${pair}: ${err.message}`);
        stillNear = true; // Keep in watchlist on transient errors
      }

      return {
        logs: localLogs,
        stillNear: stillNear && !executionSuccess,
        entryPair: finalNearEntryObj
      };
    });

    const scanResults = await Promise.all(scanPromises);
    for (const r of scanResults) {
      scanLogs.push(...r.logs);
      if (r.stillNear && r.entryPair) {
        updatedWatchlist.push(r.entryPair);
      }
    }

    socket.close();
    scanLogs.push('Near-Entry monitor execution complete.');
    await saveDerivScanLogs(existingOverrides, scanLogs, updatedWatchlist);
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
