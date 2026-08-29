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
    const handleMsg = (event: any) => {
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
    const handleMsg = (event: any) => {
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
    const handleMsg = (event: any) => {
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
async function saveDerivScanLogs(existingOverrides: any, scanLogs: string[], nearEntryPairs?: any[]) {
  try {
    const updatedOverrides = {
      ...existingOverrides,
      deriv_last_scan_at: new Date().toISOString(),
      deriv_last_scan_logs: scanLogs.slice(-15), // Keep last 15 log statements
      deriv_near_entry_pairs: nearEntryPairs !== undefined ? nearEntryPairs : (existingOverrides.deriv_near_entry_pairs || [])
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
    
    const connectAttempts = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= connectAttempts; attempt++) {
      try {
        socket = await new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(wsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            origin: 'https://crypto08-tradig-bot.vercel.app'
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

    const pairsToTrade = existingOverrides.deriv_selected_pairs || ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY'];
    scanLogs.push(`✅ Authenticated. Running scans on pairs: ${pairsToTrade.join(', ')}`);

    const scanPromises = (pairsToTrade as string[]).map(async (pair: string) => {
      const localLogs: string[] = [`Scanning ${pair}...`];
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
          return { logs: localLogs, nearEntry: null };
        }

        // B. Filter: Economic News Block
        const newsBlocked = newsFilterEnabled ? await isEconomicNewsBlocked(pair) : false;
        if (newsBlocked) {
          localLogs.push(`- Skip: High Impact News block is active for currencies in ${pair}.`);
          return { logs: localLogs, nearEntry: null };
        }

        // C. Fetch Multi-Timeframe Candles
        const candles5m = await fetchCandles(socket!, pair, 300);
        const candles15m = await fetchCandles(socket!, pair, 900);
        const candlesH1 = await fetchCandles(socket!, pair, 3600);

        const strategyResult = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
        localLogs.push(`- ADX on 15m: ${strategyResult.adxValue.toFixed(1)} | Signal: ${strategyResult.direction}`);

        if (strategyResult.nearEntry.isNear) {
          nearEntryObj = {
            symbol: pair,
            direction: strategyResult.nearEntry.direction,
            reason: strategyResult.nearEntry.reason,
            adx: strategyResult.adxValue,
            stochK: strategyResult.nearEntry.stochK,
            stochD: strategyResult.nearEntry.stochD,
            confirmations: strategyResult.nearEntry.confirmations,
            updatedAt: new Date().toISOString()
          };
        }

        if (strategyResult.direction !== 'NEUTRAL') {
          // D. Fetch tick to check spread before buying
          const tick = await fetchTick(socket!, pair);
          if (tick) {
            const spreadBlocked = isSpreadBlocked(pair, tick.ask, tick.bid);
            if (spreadBlocked) {
              localLogs.push(`- Skip: Spread of ${pair} exceeds the limit of 2.0 pips.`);
              return { logs: localLogs, nearEntry: nearEntryObj };
            }

            // E. Execute Trade!
            localLogs.push(`🔥 Trigger: Placing $${derivStakeAmount.toFixed(2)} ${strategyResult.direction} contract on ${pair} with 15m expiry.`);
            try {
              const result = await buyContract(socket!, pair, strategyResult.direction, derivStakeAmount);
              
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
              localLogs.push(`🎉 Trade executed successfully! Contract ID: ${result.contract_id}`);

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
              localLogs.push(`❌ Purchase execution error for ${pair}: ${execErr.message}`);
            }
          } else {
            localLogs.push(`❌ Error fetching ticks/spread for ${pair}. Skipping.`);
          }
        }
      } catch (err: any) {
        localLogs.push(`❌ Error processing ${pair}: ${err.message}`);
      }
      return { logs: localLogs, nearEntry: nearEntryObj };
    });

    const scanResults = await Promise.all(scanPromises);
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
