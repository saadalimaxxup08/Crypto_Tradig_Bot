import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  analyzeForex15mStrategy,
  isAsianSessionBlocked,
  isSpreadBlocked,
  isEconomicNewsBlocked,
  getRiskControlsStatus
} from '@/lib/deriv_strategy';

export const dynamic = 'force-dynamic';

const PAIRS = ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY'];

async function fetchOTP(appId: string, token: string, accountId: string) {
  const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`;
  const response = await fetch(otpUrl, {
    method: 'POST',
    headers: {
      'Deriv-App-ID': appId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status !== 200) {
    throw new Error(`Failed to generate OTP: ${await response.text()}`);
  }

  const otpData = await response.json();
  return otpData.data.url;
}

// Fetch historical candles over WebSocket
function fetchCandles(socket: WebSocket, symbol: string, granularity: number): Promise<any[]> {
  return new Promise((resolve) => {
    const handleMsg = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'candles' && data.echo_req.ticks_history === symbol && data.echo_req.granularity === granularity) {
          socket.removeEventListener('message', handleMsg);
          resolve(data.candles || []);
        }
      } catch (e) {
        // ignore
      }
    };
    socket.addEventListener('message', handleMsg);
    socket.send(JSON.stringify({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: 220,
      end: 'latest',
      granularity,
      style: 'candles'
    }));

    // Safety timeout
    setTimeout(() => {
      socket.removeEventListener('message', handleMsg);
      resolve([]);
    }, 5000);
  });
}

// Fetch bid/ask tick over WebSocket
function fetchTick(socket: WebSocket, symbol: string): Promise<{ ask: number; bid: number } | null> {
  return new Promise((resolve) => {
    const handleMsg = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'tick' && data.echo_req.ticks === symbol) {
          socket.removeEventListener('message', handleMsg);
          resolve({
            ask: parseFloat(data.tick.ask),
            bid: parseFloat(data.tick.bid)
          });
        }
      } catch (e) {
        // ignore
      }
    };
    socket.addEventListener('message', handleMsg);
    socket.send(JSON.stringify({
      ticks: symbol
    }));

    // Safety timeout
    setTimeout(() => {
      socket.removeEventListener('message', handleMsg);
      resolve(null);
    }, 4000);
  });
}

// Buy contract over WebSocket
function buyContract(socket: WebSocket, symbol: string, direction: 'CALL' | 'PUT', amount: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const handleMsg = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.error) {
          socket.removeEventListener('message', handleMsg);
          reject(new Error(msg.error.message));
          return;
        }

        if (msg.msg_type === 'proposal' && msg.echo_req.underlying_symbol === symbol && msg.echo_req.contract_type === direction) {
          // Send Buy Request
          socket.send(JSON.stringify({
            buy: msg.proposal.id,
            price: msg.proposal.ask_price
          }));
        } else if (msg.msg_type === 'buy' && msg.buy) {
          socket.removeEventListener('message', handleMsg);
          resolve(msg.buy);
        }
      } catch (e) {
        // ignore
      }
    };

    socket.addEventListener('message', handleMsg);

    // Send Proposal Request (15 Minutes Expiry)
    socket.send(JSON.stringify({
      proposal: 1,
      amount,
      basis: 'stake',
      contract_type: direction,
      currency: 'USD',
      duration: 15,
      duration_unit: 'm',
      underlying_symbol: symbol
    }));

    // Safety timeout
    setTimeout(() => {
      socket.removeEventListener('message', handleMsg);
      reject(new Error('Buy contract timed out.'));
    }, 8000);
  });
}

// Send telegram alert helper
async function sendTelegramAlert(message: string) {
  try {
    const { data: settings } = await supabase.from('settings').select('telegram_token, telegram_chat_id').eq('id', 1).single();
    const token = settings?.telegram_token || process.env.TELEGRAM_TOKEN;
    const chatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

    if (token && chatId) {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
      });
    }
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

// Save Deriv specific scan logs to settings pair_overrides JSON object
async function saveDerivScanLogs(existingOverrides: any, scanLogs: string[]) {
  try {
    const updatedOverrides = {
      ...existingOverrides,
      deriv_last_scan_at: new Date().toISOString(),
      deriv_last_scan_logs: scanLogs.slice(-15) // Keep last 15 log statements
    };
    await supabase.from('settings').update({
      pair_overrides: updatedOverrides
    }).eq('id', 1);
  } catch (err) {
    console.error('Failed to save Deriv scan logs:', err);
  }
}

export async function GET() {
  const scanLogs: string[] = [];
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

    if (!isBotEnabled) {
      scanLogs.push('⚠️ Scanner inactive: Deriv Bot is set to WORK OFF in settings.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Bot disabled', logs: scanLogs });
    }

    const activeStrategies = existingOverrides.deriv_active_strategies || ['FOREX_15M_MTF'];
    if (!activeStrategies.includes('FOREX_15M_MTF')) {
      scanLogs.push('⚠️ Scanner inactive: Forex 15m MTF Strategy is unticked (disabled) on the Deriv dashboard.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Forex 15m MTF Strategy disabled', logs: scanLogs });
    }

    const activeAccount = tradingMode === 'DEMO' ? demoAccount : realAccount;
    if (!appId || !token || !activeAccount) {
      scanLogs.push('❌ Error: Missing Deriv credentials or active account configuration.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Missing credentials', logs: scanLogs });
    }

    // 2. Filter: Session Check
    if (isAsianSessionBlocked()) {
      scanLogs.push('⏳ Session Filter: Asian session block active (21:00 - 23:59 GMT). Skipping trade scans.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Asian session block', logs: scanLogs });
    }

    // 3. Filter: Risk Controls Check
    const derivMaxTrades = existingOverrides.deriv_max_trades || 10;
    const { count: openTradesCount, error: countErr } = await supabase
      .from('deriv_trades')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'OPEN');

    if (!countErr && openTradesCount !== null && openTradesCount >= derivMaxTrades) {
      scanLogs.push(`⚠️ Halted execution: Open trades count (${openTradesCount}) reached the maximum limit of ${derivMaxTrades}. Skipping.`);
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Max trades limit reached', logs: scanLogs });
    }

    const riskControls = await getRiskControlsStatus();
    if (riskControls.isDailyLimitBlocked) {
      scanLogs.push(`🚨 Risk Control: Daily limit of 10 trades reached (${riskControls.dailyTradesCount} trades today). Skipping.`);
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Daily limit reached', logs: scanLogs });
    }
    if (riskControls.isCooldownBlocked) {
      scanLogs.push('🚨 Risk Control: 2 consecutive losses detected. Cooldown period (60m) active. Skipping.');
      await saveDerivScanLogs(existingOverrides, scanLogs);
      return NextResponse.json({ success: true, message: 'Cooldown active', logs: scanLogs });
    }

    // 4. Connect WebSocket
    const wsUrl = await fetchOTP(appId, token, activeAccount);
    const socket = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => resolve(ws);
      ws.onerror = (e) => reject(new Error('WebSocket connection failed.'));
      setTimeout(() => reject(new Error('Connection timed out.')), 6000);
    });

    const pairsToTrade = existingOverrides.deriv_selected_pairs || ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY'];
    scanLogs.push(`✅ Authenticated. Running scans on pairs: ${pairsToTrade.join(', ')}`);

    for (const pair of pairsToTrade) {
      scanLogs.push(`Scanning ${pair}...`);

      // A. Check if trade already open for this symbol (Max 1 active trade per pair)
      const { data: openTrades, error: checkErr } = await supabase
        .from('deriv_trades')
        .select('*')
        .eq('symbol', pair)
        .eq('status', 'OPEN');

      if (!checkErr && openTrades && openTrades.length > 0) {
        scanLogs.push(`- Skip: A contract is already open for ${pair}.`);
        continue;
      }

      // B. Filter: Economic News Block
      const newsBlocked = await isEconomicNewsBlocked(pair);
      if (newsBlocked) {
        scanLogs.push(`- Skip: High Impact News block is active for currencies in ${pair}.`);
        continue;
      }

      // C. Fetch Multi-Timeframe Candles
      const candles5m = await fetchCandles(socket, pair, 300);
      const candles15m = await fetchCandles(socket, pair, 900);
      const candlesH1 = await fetchCandles(socket, pair, 3600);

      const strategyResult = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
      scanLogs.push(`- ADX on 15m: ${strategyResult.adxValue.toFixed(1)} | Signal: ${strategyResult.direction}`);

      if (strategyResult.direction !== 'NEUTRAL') {
        // D. Fetch tick to check spread before buying
        const tick = await fetchTick(socket, pair);
        if (tick) {
          const spreadBlocked = isSpreadBlocked(pair, tick.ask, tick.bid);
          if (spreadBlocked) {
            scanLogs.push(`- Skip: Spread of ${pair} exceeds the limit of 2.0 pips.`);
            continue;
          }

          // E. Execute Trade!
          scanLogs.push(`🔥 Trigger: Placing $${derivStakeAmount.toFixed(2)} ${strategyResult.direction} contract on ${pair} with 15m expiry.`);
          try {
            const result = await buyContract(socket, pair, strategyResult.direction, derivStakeAmount);
            
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
              created_at: new Date().toISOString(),
              closed_at: null
            };

            await supabase.from('deriv_trades').insert([newTrade]);
            scanLogs.push(`🎉 Trade executed successfully! Contract ID: ${result.contract_id}`);

            // Send Telegram Signal Notification
            const gmtTime = new Date().toUTCString();
            const signalMsg = `🚀 <b>DERIV OP-BOT SIGNAL ALERT</b> 🚀\n` +
              `-------------------------------------\n` +
              `<b>Asset Pair:</b> ${pair.replace('frx', '')}\n` +
              `<b>Option Direction:</b> ${strategyResult.direction === 'CALL' ? '🟢 RISE (CALL)' : '🔴 FALL (PUT)'}\n` +
              `<b>Entry Price:</b> $${result.buy_price}\n` +
              `<b>Contract Expiry:</b> 15 Minutes\n` +
              `<b>Scan Time (GMT):</b> ${gmtTime}\n` +
              `<b>Analysis Stats:</b> H1 Trend: ${strategyResult.direction === 'CALL' ? 'BULLISH' : 'BEARISH'} | ADX: ${strategyResult.adxValue.toFixed(1)}\n` +
              `<b>Account Mode:</b> ${tradingMode} Sandbox`;
            
            await sendTelegramAlert(signalMsg);

          } catch (execErr: any) {
            scanLogs.push(`❌ Purchase execution error for ${pair}: ${execErr.message}`);
          }
        } else {
          scanLogs.push(`❌ Error fetching ticks/spread for ${pair}. Skipping.`);
        }
      }
    }

    socket.close();
    scanLogs.push('Scan loop execution complete.');
    await saveDerivScanLogs(existingOverrides, scanLogs);
    return NextResponse.json({ success: true, logs: scanLogs });

  } catch (err: any) {
    scanLogs.push(`❌ System Error occurred: ${err.message}`);
    await saveDerivScanLogs(existingOverrides, scanLogs);
    return NextResponse.json({ error: err.message, logs: scanLogs }, { status: 500 });
  }
}
