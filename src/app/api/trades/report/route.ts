import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';
import { getBinanceClient } from '@/lib/binance';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { startDate, endDate } = await request.json();
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
    }

    // 1. Fetch settings to get telegram credentials, keys, and trading mode
    const { data: settings } = await supabase
      .from('settings')
      .select('telegram_token, telegram_chat_id, trading_mode, binance_demo_api_key, binance_demo_secret_key, binance_real_api_key, binance_real_secret_key, binance_api_key, binance_secret_key')
      .eq('id', 1)
      .single();

    const telegramToken = settings?.telegram_token || process.env.TELEGRAM_TOKEN || '';
    const telegramChatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';
    const tradingMode = settings?.trading_mode || 'DEMO';

    if (!telegramToken || !telegramChatId) {
      return NextResponse.json({ error: 'Telegram credentials not configured in settings!' }, { status: 400 });
    }

    // Load API Keys
    const isDemo = tradingMode === 'DEMO';
    const binance_api_key = isDemo 
      ? (settings?.binance_demo_api_key || settings?.binance_api_key || process.env.BINANCE_API_KEY || '')
      : (settings?.binance_real_api_key || process.env.BINANCE_API_KEY || '');
    const binance_secret_key = isDemo 
      ? (settings?.binance_demo_secret_key || settings?.binance_secret_key || process.env.BINANCE_SECRET_KEY || '')
      : (settings?.binance_real_secret_key || process.env.BINANCE_SECRET_KEY || '');

    // 2. Fetch active/running trades from DB
    const { data: openTrades } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'OPEN');

    // Fetch active tickers to calculate floating P&Ls
    let livePrices: Record<string, number> = {};
    if (openTrades && openTrades.length > 0 && binance_api_key && binance_secret_key) {
      try {
        const exchange = getBinanceClient(binance_api_key, binance_secret_key, isDemo);
        const tickers = await exchange.fetchTickers();
        for (const t of openTrades) {
          const ticker = tickers[t.pair];
          if (ticker) {
            livePrices[t.pair] = parseFloat(ticker.last || ticker.close || t.entry_price);
          }
        }
      } catch (err) {
        console.error('Failed to load active tickers in report:', err);
      }
    }

    // 3. Fetch closed trades in the selected range
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'CLOSED')
      .gte('closed_at', startDate)
      .lte('closed_at', endDate)
      .order('closed_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 4. Compile report metrics
    const totalTrades = trades ? trades.length : 0;
    const wins = trades ? trades.filter((t) => parseFloat(t.pnl || 0) > 0).length : 0;
    const losses = totalTrades - wins;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const grossPnl = trades ? trades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0) : 0;

    const startFormatted = new Date(startDate).toLocaleDateString();
    const endFormatted = new Date(endDate).toLocaleDateString();

    const pnlSign = grossPnl >= 0 ? '+' : '';
    const pnlEmoji = grossPnl >= 0 ? '🟢' : '🔴';

    let msg = `📊 <b>VIP TRADER SUMMARY REPORT (${tradingMode})</b>\n` +
      `Period: <b>${startFormatted}</b> to <b>${endFormatted}</b>\n` +
      `-----------------------------------\n` +
      `Total Closed Trades: <b>${totalTrades}</b>\n` +
      `Win Rate: <b>${winRate.toFixed(1)}%</b> (Wins: ${wins} / Losses: ${losses})\n` +
      `Net Realized P&L: <b>${pnlSign}${grossPnl.toFixed(4)} USDT</b> ${pnlEmoji}\n` +
      `-----------------------------------\n`;

    // 5. Add active running trades if any exist
    if (openTrades && openTrades.length > 0) {
      msg += `🏃‍♂️ <b>ACTIVE RUNNING POSITIONS (${openTrades.length}):</b>\n`;
      openTrades.forEach((t) => {
        const curPrice = livePrices[t.pair] || t.entry_price;
        const pnl = (curPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
        
        const entryTime = new Date(t.timestamp);
        const durationMs = Date.now() - entryTime.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

        const sign = pnl >= 0 ? '+' : '';
        const emoji = pnl >= 0 ? '🟢' : '🔴';
        msg += `- <b>${t.pair}</b> ${t.direction}: <b>${sign}${pnl.toFixed(2)} USDT</b> ${emoji} (Open: ${durationStr})\n`;
      });
      msg += `-----------------------------------\n`;
    } else {
      msg += `🏃‍♂️ No active positions running.\n-----------------------------------\n`;
    }

    // 6. Add closed trades ledger
    msg += `<b>CLOSED TRADES LEDGER:</b>\n`;
    if (trades && trades.length > 0) {
      const displayTrades = trades.slice(-15);
      displayTrades.forEach((t) => {
        const entryTime = new Date(t.timestamp);
        const exitTime = new Date(t.closed_at);
        const durationMin = ((exitTime.getTime() - entryTime.getTime()) / 1000 / 60).toFixed(0);
        const sign = (t.pnl || 0) >= 0 ? '+' : '';
        msg += `- <b>${t.pair}</b> ${t.direction}: ${sign}${parseFloat(t.pnl || 0).toFixed(2)} USDT (${durationMin}m)\n`;
      });

      if (trades.length > 15) {
        msg += `... and ${trades.length - 15} more trades in this period.\n`;
      }
    } else {
      msg += `No closed trades recorded in this period.\n`;
    }

    // 7. Send message via Telegram
    await sendTelegramMessage(telegramToken, telegramChatId, msg);

    return NextResponse.json({ success: true, message: 'Report sent to Telegram successfully!' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
