import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

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

    // 1. Fetch settings to get telegram credentials and trading mode
    const { data: settings } = await supabase
      .from('settings')
      .select('telegram_token, telegram_chat_id, trading_mode')
      .eq('id', 1)
      .single();

    const telegramToken = settings?.telegram_token || process.env.TELEGRAM_TOKEN || '';
    const telegramChatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';
    const tradingMode = settings?.trading_mode || 'DEMO';

    if (!telegramToken || !telegramChatId) {
      return NextResponse.json({ error: 'Telegram credentials not configured in settings!' }, { status: 400 });
    }

    // 2. Fetch closed trades in the selected range
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

    if (!trades || trades.length === 0) {
      return NextResponse.json({ success: true, message: 'No trades found in the selected range to send.' });
    }

    // 3. Compile report metrics
    const totalTrades = trades.length;
    const wins = trades.filter((t) => parseFloat(t.pnl || 0) > 0).length;
    const losses = totalTrades - wins;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    
    const grossPnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    // Rough estimate of fees included in DB pnl (which has fees deducted already)
    const totalNetPnl = grossPnl;

    const startFormatted = new Date(startDate).toLocaleDateString();
    const endFormatted = new Date(endDate).toLocaleDateString();

    // 4. Format Telegram Markdown/HTML Message
    const pnlSign = totalNetPnl >= 0 ? '+' : '';
    const pnlEmoji = totalNetPnl >= 0 ? '🟢' : '🔴';

    let msg = `📊 <b>VIP TRADER REPORT (${tradingMode})</b>\n` +
      `Period: <b>${startFormatted}</b> to <b>${endFormatted}</b>\n` +
      `-----------------------------------\n` +
      `Total Closed Trades: <b>${totalTrades}</b>\n` +
      `Win Rate: <b>${winRate.toFixed(1)}%</b> (Wins: ${wins} / Losses: ${losses})\n` +
      `Net Cumulative P&L: <b>${pnlSign}${totalNetPnl.toFixed(4)} USDT</b> ${pnlEmoji}\n` +
      `-----------------------------------\n` +
      `<b>CLOSED TRADES LEDGER:</b>\n`;

    // Add last 15 trades details to keep message size within Telegram limit
    const displayTrades = trades.slice(-15);
    displayTrades.forEach((t) => {
      const entryTime = new Date(t.timestamp);
      const exitTime = new Date(t.closed_at);
      const durationMin = ((exitTime.getTime() - entryTime.getTime()) / 1000 / 60).toFixed(0);
      const sign = (t.pnl || 0) >= 0 ? '+' : '';
      msg += `- <b>${t.pair}</b> ${t.direction}: ${sign}${parseFloat(t.pnl || 0).toFixed(2)} USDT (${durationMin}m)\n`;
    });

    if (trades.length > 15) {
      msg += `... and ${trades.length - 15} more trades in this period.`;
    }

    // 5. Send message via Telegram
    await sendTelegramMessage(telegramToken, telegramChatId, msg);

    return NextResponse.json({ success: true, message: 'Report sent to Telegram successfully!' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
