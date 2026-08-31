import WebSocket from 'ws';
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';

export async function fetchOTP(appId: string, token: string, accountId: string): Promise<string> {
  const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`;
  const response = await fetch(otpUrl, {
    method: 'POST',
    headers: {
      'Deriv-App-ID': appId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
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
export function buyContract(socket: WebSocket, symbol: string, direction: 'CALL' | 'PUT', amount: number, duration: number = 15): Promise<any> {
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

    // Send Proposal Request
    socket.send(JSON.stringify({
      proposal: 1,
      amount,
      basis: 'stake',
      contract_type: direction,
      currency: 'USD',
      duration,
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
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
        cache: 'no-store'
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
    const promises: Promise<any>[] = [];

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
            
            const exitPrice = contract.exit_tick ? parseFloat(contract.exit_tick) : (contract.exit_spot ? parseFloat(contract.exit_spot) : null);
            const entryPrice = contract.entry_tick ? parseFloat(contract.entry_tick) : (contract.entry_spot ? parseFloat(contract.entry_spot) : matchingTrade.entry_price);

            if (isExpired) {
              const closedAt = new Date().toISOString();
              
              const p = (async () => {
                try {
                  // Update database first
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

                  // 1. Fetch candles for the closed trade duration
                  let candles: any[] = [];
                  try {
                    const startEpoch = contract.date_start;
                    const endEpoch = contract.exit_tick_time || contract.date_expiry || contract.exit_spot_time;
                    if (startEpoch && endEpoch) {
                      candles = await fetchClosedTradeCandles(socket, matchingTrade.symbol, startEpoch, endEpoch);
                    }
                  } catch (candleErr) {
                    console.error('Failed to fetch closed trade candles for PDF:', candleErr);
                  }

                  // 2. Generate PDF Report containing the candlestick chart
                  let pdfBuffer: Buffer | null = null;
                  try {
                    const tradeCopy = { ...matchingTrade, status, entry_price: entryPrice, exit_price: exitPrice };
                    pdfBuffer = await generateTradePDF(tradeCopy, contract, candles);
                  } catch (pdfErr) {
                    console.error('Failed to generate trade PDF:', pdfErr);
                  }

                  // 3. Send Telegram Notification
                  const outcomeMsg = `🔔 <b>DERIV CONTRACT COMPLETED</b> 🔔\n` +
                    `-------------------------------------\n` +
                    `<b>Asset Pair:</b> ${getDisplaySymbolName(matchingTrade.symbol)}\n` +
                    `<b>Type:</b> ${matchingTrade.contract_type === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}\n` +
                    `<b>Outcome:</b> ${status === 'WON' ? '🟢 WIN (WON)' : '🔴 LOSS (LOST)'}\n` +
                    `<b>Profit/Loss:</b> ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USD\n` +
                    `<b>Entry Price:</b> $${entryPrice}\n` +
                    `<b>Exit Price:</b> $${exitPrice || 'N/A'}`;
                  
                  await sendTelegramAlert(outcomeMsg);

                  // 4. Send PDF Document to Telegram
                  if (pdfBuffer) {
                    const filename = `Trade_Report_${matchingTrade.contract_id}.pdf`;
                    const docCaption = `📊 <b>Trade Report: ${getDisplaySymbolName(matchingTrade.symbol)}</b>\nOutcome: ${status === 'WON' ? '🏆 WIN' : '❌ LOSS'} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USD)`;
                    await sendTelegramDocument(pdfBuffer, filename, docCaption);
                  }
                } catch (err: any) {
                  console.error(`Error processing sync for trade ${contractId}:`, err.message);
                }
              })();
              
              promises.push(p);
            }

            pending--;
            if (pending <= 0) {
              socket.removeEventListener('message', handleMsg);
              Promise.all(promises).then(() => {
                resolve();
              });
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

    // Safety timeout
    setTimeout(() => {
      socket.removeEventListener('message', handleMsg);
      Promise.all(promises).then(() => {
        resolve();
      });
    }, 10000);
  });
}

export function fetchClosedTradeCandles(
  socket: WebSocket,
  symbol: string,
  start: number,
  end: number
): Promise<any[]> {
  return new Promise((resolve) => {
    const handleMsg = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'candles' && data.echo_req.ticks_history === symbol && data.echo_req.start === start) {
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
      start,
      end,
      granularity: 60,
      style: 'candles'
    }));

    // Safety timeout
    setTimeout(() => {
      socket.removeEventListener('message', handleMsg);
      resolve([]);
    }, 5000);
  });
}

export async function generateTradePDF(trade: any, contract: any, candles: any[]): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header Slate-900 Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 38, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('DERIV BINARY OPTIONS - CONTRACT REPORT', 14, 16);

  // Subtitle
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  const dateStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
  doc.text(`Generated: ${dateStr} (Jeddah Time) | Contract ID: ${trade.contract_id}`, 14, 26);

  // Outcome Badge
  const isWin = trade.status === 'WON';
  doc.setFillColor(isWin ? 22 : 220, isWin ? 163 : 38, isWin ? 74 : 38); // green-600 or red-600
  doc.roundedRect(155, 10, 40, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isWin ? '🏆 WIN' : '❌ LOSS', 175, 19, { align: 'center' });

  // Main Details Grid (Y: 48)
  let y = 48;
  
  // Left Column Details Card
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, y, 85, 95, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('CONTRACT DETAILS', 18, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 35);
  
  const drawRow = (label: string, value: string, rowY: number, valColor?: number[]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(label, 18, rowY);
    
    doc.setFont('helvetica', 'normal');
    if (valColor) {
      doc.setTextColor(valColor[0], valColor[1], valColor[2]);
    } else {
      doc.setTextColor(15, 23, 42); // slate-900
    }
    doc.text(value, 50, rowY);
  };

  const displayName = getDisplaySymbolName(trade.symbol).split(' (')[0];
  const pnl = parseFloat(contract.profit || 0);

  drawRow('Asset Pair:', displayName, y + 18);
  drawRow('Contract Type:', trade.contract_type === 'CALL' ? 'RISE (CALL)' : 'FALL (PUT)', y + 26, trade.contract_type === 'CALL' ? [22, 163, 74] : [220, 38, 38]);
  drawRow('Stake Amount:', `$${trade.stake.toFixed(2)}`, y + 34);
  drawRow('Total Payout:', `$${trade.payout.toFixed(2)}`, y + 42);
  
  const profitColor = pnl >= 0 ? [22, 163, 74] : [220, 38, 38];
  drawRow('Net Profit/Loss:', `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USD`, y + 50, profitColor);
  drawRow('Duration:', `${contract.duration} ${contract.duration_unit || 'minutes'}`, y + 58);
  const entrySpotVal = contract.entry_tick || contract.entry_spot || trade.entry_price || 0;
  const exitSpotVal = contract.exit_tick || contract.exit_spot || trade.exit_price || 0;
  drawRow('Entry Spot:', `$${parseFloat(entrySpotVal).toFixed(2)}`, y + 66);
  drawRow('Exit Spot:', `$${parseFloat(exitSpotVal).toFixed(2)}`, y + 74);
  
  const startTimeStr = new Date((contract.date_start || (Date.now() / 1000)) * 1000).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
  const endTimeEpoch = contract.exit_tick_time || contract.date_expiry || contract.exit_spot_time || (Date.now() / 1000);
  const endTimeStr = new Date(endTimeEpoch * 1000).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
  drawRow('Start Time:', startTimeStr.split(', ')[1] || startTimeStr, y + 82);
  drawRow('Close Time:', endTimeStr.split(', ')[1] || endTimeStr, y + 90);

  // Right Column Chart Area (Y: 48)
  const chartX = 105;
  const chartWidth = 90;
  const chartHeight = 95;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(chartX, y, chartWidth, chartHeight, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('1-MINUTE CANDLE CHART (TIMELINE)', chartX + 5, y + 8);

  // Draw Candlestick Vector Chart inside PDF
  if (candles.length > 0) {
    const chartPadX = 8;
    const chartPadTop = 18;
    const chartPadBottom = 12;

    const plotX = chartX + chartPadX;
    const plotY = y + chartPadTop;
    const plotW = chartWidth - (chartPadX * 2);
    const plotH = chartHeight - chartPadTop - chartPadBottom;

    // Draw Border and Grid lines
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.rect(plotX, plotY, plotW, plotH);

    // Draw Grid Lines (3 horizontal)
    for (let i = 1; i <= 3; i++) {
      const gridY = plotY + (plotH * i) / 4;
      doc.line(plotX, gridY, plotX + plotW, gridY);
    }

    // Calculate boundaries
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const priceDiff = maxP - minP || 1;

    // Add padding to price scale
    const finalMinP = minP - (priceDiff * 0.05);
    const finalMaxP = maxP + (priceDiff * 0.05);
    const finalDiff = finalMaxP - finalMinP;

    const getPixelY = (price: number) => {
      const percent = (price - finalMinP) / finalDiff;
      return plotY + plotH - (plotH * percent); // Invert Y for drawing coordinates
    };

    // Draw Candles
    const totalCandles = candles.length;
    const candleWidth = (plotW / totalCandles) * 0.6;
    const stepX = plotW / totalCandles;

    for (let i = 0; i < totalCandles; i++) {
      const c = candles[i];
      const candleX = plotX + (i * stepX) + (stepX - candleWidth) / 2;
      
      const wickTopY = getPixelY(c.high);
      const wickBottomY = getPixelY(c.low);
      const bodyTopY = getPixelY(Math.max(c.open, c.close));
      const bodyBottomY = getPixelY(Math.min(c.open, c.close));
      const bodyHeight = Math.max(0.3, Math.abs(bodyTopY - bodyBottomY));

      const isGreen = c.close >= c.open;
      
      // Draw wick line
      doc.setDrawColor(isGreen ? 34 : 220, isGreen ? 197 : 38, isGreen ? 94 : 38);
      doc.setLineWidth(0.3);
      doc.line(candleX + (candleWidth / 2), wickTopY, candleX + (candleWidth / 2), wickBottomY);

      // Draw body rect
      doc.setFillColor(isGreen ? 34 : 220, isGreen ? 197 : 38, isGreen ? 94 : 38);
      doc.rect(candleX, bodyTopY, candleWidth, bodyHeight, 'F');
    }

    // Draw Entry Spot Price line (dashed line)
    const entrySpotY = getPixelY(parseFloat(contract.entry_tick));
    if (entrySpotY >= plotY && entrySpotY <= plotY + plotH) {
      doc.setDrawColor(34, 197, 94); // Green
      doc.setLineWidth(0.4);
      for (let dotX = plotX; dotX < plotX + plotW; dotX += 2) {
        doc.line(dotX, entrySpotY, dotX + 1, entrySpotY);
      }
      
      doc.setFillColor(34, 197, 94);
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      doc.rect(plotX + 2, entrySpotY - 3, 12, 2.6, 'F');
      doc.text('Entry Spot', plotX + 2.5, entrySpotY - 1);
    }

    // Price Labels Axis (Right side)
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(finalMaxP.toFixed(2), plotX + plotW - 12, plotY + 4);
    doc.text(finalMinP.toFixed(2), plotX + plotW - 12, plotY + plotH - 2);
  }

  // Footer Branding and Disclaimer
  y = 155;
  doc.setDrawColor(241, 245, 249);
  doc.line(14, y, 196, y);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('This is an automatically generated contract execution receipt by the Crypto Trading Bot.', 14, y + 6);
  doc.text('Deriv API documentation guidelines and risk control parameters have been fully enforced.', 14, y + 10);

  const pdfString = doc.output('arraybuffer');
  return Buffer.from(pdfString);
}

export async function sendTelegramDocument(pdfBuffer: Buffer, filename: string, caption: string) {
  try {
    const { data: settings } = await supabase.from('settings').select('telegram_token, telegram_chat_id').eq('id', 1).single();
    const token = settings?.telegram_token || process.env.TELEGRAM_TOKEN;
    const chatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

    if (token && chatId) {
      const url = `https://api.telegram.org/bot${token}/sendDocument`;
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      
      const blob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
      formData.append('document', blob, filename);

      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error('Failed to send PDF to Telegram API:', data);
      }
    }
  } catch (err) {
    console.error('Error sending Telegram PDF document:', err);
  }
}
