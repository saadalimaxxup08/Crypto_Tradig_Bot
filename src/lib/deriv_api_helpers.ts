import WebSocket from 'ws';
import { supabase } from './supabase';

export async function fetchOTP(appId: string, token: string, accountId: string): Promise<string> {
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
export function fetchCandles(socket: WebSocket, symbol: string, granularity: number): Promise<any[]> {
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
export function fetchTick(socket: WebSocket, symbol: string): Promise<{ ask: number; bid: number } | null> {
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
export function buyContract(socket: WebSocket, symbol: string, direction: 'CALL' | 'PUT', amount: number): Promise<any> {
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
export async function sendTelegramAlert(message: string) {
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
export async function saveDerivScanLogs(existingOverrides: any, scanLogs: string[], nearEntryPairs?: any[]) {
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
const SYMBOL_NAMES: { [key: string]: string } = {
  // Forex
  frxEURUSD: 'EUR/USD',
  frxGBPUSD: 'GBP/USD',
  frxUSDJPY: 'USD/JPY',
  frxAUDUSD: 'AUD/USD',
  frxUSDCAD: 'USD/CAD',
  frxUSDCHF: 'USD/CHF',
  frxAUDJPY: 'AUD/JPY',
  frxEURJPY: 'EUR/JPY',
  frxGBPJPY: 'GBP/JPY',
  frxXAUUSD: 'Gold / USD',
  frxXAGUSD: 'Silver / USD',
  cryBTCUSD: 'BTC/USD',
  cryETHUSD: 'ETH/USD',
  // Synthetics
  R_10: 'Volatility 10 Index',
  R_25: 'Volatility 25 Index',
  R_50: 'Volatility 50 Index',
  R_75: 'Volatility 75 Index',
  R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  BOOM500: 'Boom 500 Index',
  BOOM1000: 'Boom 1000 Index',
  CRASH500: 'Crash 500 Index',
  CRASH1000: 'Crash 1000 Index',
  JD50: 'Jump 50 Index',
  stpRNG: 'Step Index',
  RB100: 'Range Break 100',
  RB200: 'Range Break 200',
  // Unusual/Others
  frxEURGBP: 'EUR/GBP',
  frxEURAUD: 'EUR/AUD',
  frxEURCAD: 'EUR/CAD',
  frxEURCHF: 'EUR/CHF',
  frxGBPAUD: 'GBP/AUD',
  frxAUDCAD: 'AUD/CAD',
  frxAUDCHF: 'AUD/CHF',
  frxAUDNZD: 'AUD/NZD',
  frxEURNZD: 'EUR/NZD',
  frxGBPCAD: 'GBP/CAD',
  frxGBPCHF: 'GBP/CHF',
  frxGBPNZD: 'GBP/NZD',
  frxNZDJPY: 'NZD/JPY',
  frxNZDUSD: 'NZD/USD',
  frxUSDMXN: 'USD/MXN',
  frxUSDPLN: 'USD/PLN',
  frxXPDUSD: 'Palladium / USD',
  frxXPTUSD: 'Platinum / USD',
  OTC_NDX: 'US Tech 100',
  OTC_SPC: 'US 500',
  OTC_DJI: 'Wall Street 30',
  OTC_FTSE: 'UK 100',
  OTC_GDAXI: 'Germany 40',
  OTC_FCHI: 'France 40',
  OTC_SX5E: 'Euro 50',
  OTC_N225: 'Japan 225',
  OTC_HSI: 'Hong Kong 50',
  OTC_AS51: 'Australia 200',
  OTC_AEX: 'Netherlands 25',
  OTC_SSMI: 'Swiss 20',
  WLDAUD: 'AUD Basket',
  WLDEUR: 'EUR Basket',
  WLDGBP: 'GBP Basket',
  WLDUSD: 'USD Basket',
  WLDXAU: 'Gold Basket',
  RDBEAR: 'Bear Market Index',
  RDBULL: 'Bull Market Index',
  '1HZ15V': 'Volatility 15 (1s) Index',
  '1HZ30V': 'Volatility 30 (1s) Index',
  '1HZ90V': 'Volatility 90 (1s) Index',
  BOOM50: 'Boom 50 Index',
  BOOM150N: 'Boom 150 Index',
  BOOM300N: 'Boom 300 Index',
  BOOM600: 'Boom 600 Index',
  BOOM900: 'Boom 900 Index',
  CRASH50: 'Crash 50 Index',
  CRASH150N: 'Crash 150 Index',
  CRASH300N: 'Crash 300 Index',
  CRASH600: 'Crash 600 Index',
  CRASH900: 'Crash 900 Index',
  JD10: 'Jump 10 Index',
  JD25: 'Jump 25 Index',
  JD100: 'Jump 100 Index',
  stpRNG2: 'Step Index 200',
  stpRNG3: 'Step Index 300',
  stpRNG4: 'Step Index 400',
  stpRNG5: 'Step Index 500'
};

export function getDisplaySymbolName(symbol: string): string {
  const name = SYMBOL_NAMES[symbol];
  return name ? `${name} (${symbol})` : symbol;
}
export function syncOpenTrades(socket: WebSocket, openTrades: any[]): Promise<void> {
  if (openTrades.length === 0) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let pending = openTrades.length;
    const handleMsg = async (event: any) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract) {
          const contract = msg.proposal_open_contract;
          const contractId = contract.contract_id;
          
          const matchingTrade = openTrades.find(t => t.contract_id === contractId);
          if (matchingTrade) {
            const isExpired = contract.is_expired;
            const status = isExpired ? (contract.profit > 0 ? 'WON' : 'LOST') : 'OPEN';
            const pnl = parseFloat(contract.profit || 0);
            const exitPrice = contract.exit_tick ? parseFloat(contract.exit_tick) : null;
            const entryPrice = contract.entry_tick ? parseFloat(contract.entry_tick) : matchingTrade.entry_price;

            if (isExpired) {
              const closedAt = new Date().toISOString();
              // Update database
              await supabase
                .from('deriv_trades')
                .update({
                  status,
                  pnl,
                  exit_price: exitPrice,
                  entry_price: entryPrice,
                  closed_at: closedAt
                })
                .eq('id', matchingTrade.id);

              // Send Telegram Notification
              const outcomeMsg = `🔔 <b>DERIV CONTRACT COMPLETED</b> 🔔\n` +
                `-------------------------------------\n` +
                `<b>Asset Pair:</b> ${getDisplaySymbolName(matchingTrade.symbol)}\n` +
                `<b>Type:</b> ${matchingTrade.contract_type === 'CALL' ? '🟢 RISE (CALL)' : '🔴 FALL (PUT)'}\n` +
                `<b>Outcome:</b> ${status === 'WON' ? '🏆 WIN' : '❌ LOSS'}\n` +
                `<b>Profit/Loss:</b> ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USD\n` +
                `<b>Entry Price:</b> $${entryPrice}\n` +
                `<b>Exit Price:</b> $${exitPrice || 'N/A'}`;
              
              await sendTelegramAlert(outcomeMsg);
            }

            pending--;
            if (pending <= 0) {
              socket.removeEventListener('message', handleMsg);
              resolve();
            }
          }
        }
      } catch (err) {
        console.error('Error in proposal_open_contract handler:', err);
      }
    };

    socket.addEventListener('message', handleMsg);

    // Send status request for each open trade
    for (const trade of openTrades) {
      socket.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: trade.contract_id
      }));
    }

    // Safety timeout: if server doesn't respond, resolve anyway in 8 seconds
    setTimeout(() => {
      socket.removeEventListener('message', handleMsg);
      resolve();
    }, 8000);
  });
}
