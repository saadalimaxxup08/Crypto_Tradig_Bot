import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient, closeActivePosition, fetchCurrentPrice } from '@/lib/binance';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { tradeId } = await request.json();
    if (!tradeId) {
      return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 });
    }

    // 1. Fetch trade details from Supabase
    const { data: trade, error: tradeErr } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeErr || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    if (trade.status !== 'OPEN') {
      return NextResponse.json({ error: 'Trade is already closed' }, { status: 400 });
    }

    // 2. Fetch Binance credentials from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('binance_api_key, binance_secret_key, telegram_token, telegram_chat_id')
      .eq('id', 1)
      .single();

    if (!settings?.binance_api_key || !settings?.binance_secret_key) {
      return NextResponse.json({ error: 'Binance API credentials missing in settings' }, { status: 400 });
    }

    // 3. Initialize Binance Client & Close Position
    const exchange = getBinanceClient(settings.binance_api_key, settings.binance_secret_key);
    
    // Fetch current price for final calculations
    const currentPrice = await fetchCurrentPrice(exchange, trade.pair);
    
    // Close position on Binance
    console.log(`Manually closing position for ${trade.pair}: size ${trade.amount}`);
    await closeActivePosition(exchange, trade.pair, trade.direction, trade.amount);

    // Calculate realized P&L
    const realizedPnl = (currentPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);

    // 4. Update Database
    const { error: updateErr } = await supabase
      .from('trades')
      .update({
        status: 'CLOSED',
        exit_price: currentPrice,
        pnl: realizedPnl,
        closed_at: new Date().toISOString(),
      })
      .eq('id', tradeId);

    if (updateErr) {
      throw new Error(`Failed to update trade in DB: ${updateErr.message}`);
    }

    // 5. Send Telegram Notification
    const msg = `🔴 <b>TRADE CLOSED MANUALLY</b>\n` +
      `Pair: <b>${trade.pair}</b> ${trade.direction}\n` +
      `Exit Price: <b>${currentPrice}</b>\n` +
      `P&L: <b>${realizedPnl.toFixed(2)} USDT</b>`;

    await sendTelegramMessage(settings.telegram_token, settings.telegram_chat_id, msg);

    return NextResponse.json({ success: true, exitPrice: currentPrice, pnl: realizedPnl });
  } catch (err: any) {
    console.error('Failed to close trade:', err);
    return NextResponse.json({ error: err.message || 'Failed to close position' }, { status: 500 });
  }
}
