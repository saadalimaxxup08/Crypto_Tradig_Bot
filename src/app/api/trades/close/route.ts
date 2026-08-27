import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient, closeActivePosition, fetchCurrentPrice, fetchFuturesBalance } from '@/lib/binance';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { tradeId, symbol } = await request.json();
    if (!tradeId && !symbol) {
      return NextResponse.json({ error: 'Trade ID or Symbol is required' }, { status: 400 });
    }

    // 1. Fetch Binance credentials from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 400 });
    }

    const isDemo = (settings.trading_mode || 'DEMO') === 'DEMO';
    const binance_api_key = isDemo 
      ? (settings.binance_demo_api_key || settings.binance_api_key || '')
      : (settings.binance_real_api_key || '');
    const binance_secret_key = isDemo 
      ? (settings.binance_demo_secret_key || settings.binance_secret_key || '')
      : (settings.binance_real_secret_key || '');

    if (!binance_api_key || !binance_secret_key) {
      return NextResponse.json({ error: 'Binance API credentials missing in settings' }, { status: 400 });
    }

    const exchange = getBinanceClient(binance_api_key, binance_secret_key, isDemo);

    // --- CASE A: DIRECT SYMBOL CLOSURE (Orphaned positions) ---
    if (symbol) {
      const positions = await exchange.fetchPositions();
      const pos = positions.find((p: any) => p.symbol === symbol || p.symbol.replace('/USDT:USDT', 'USDT') === symbol);
      if (!pos) {
        return NextResponse.json({ error: `Active position for ${symbol} not found on Binance` }, { status: 404 });
      }

      const amount = Math.abs(parseFloat((pos as any).contracts || (pos as any).positionAmt || 0));
      const direction = parseFloat((pos as any).contracts || (pos as any).positionAmt || 0) > 0 ? 'LONG' : 'SHORT';

      if (amount <= 0) {
        return NextResponse.json({ error: 'Position is already closed' }, { status: 400 });
      }

      console.log(`Directly closing Binance position for ${symbol}: size ${amount}`);
      const closeOrder = await closeActivePosition(exchange, (pos as any).symbol, direction, amount);

      // Resolve any corresponding OPEN trades in the DB for this pair
      const pairName = (pos as any).symbol.includes('/') ? (pos as any).symbol.split('/')[0] + 'USDT' : (pos as any).symbol;
      const { data: dbOpenTrades } = await supabase
        .from('trades')
        .select('id')
        .eq('pair', pairName)
        .eq('status', 'OPEN');

      if (dbOpenTrades && dbOpenTrades.length > 0) {
        await supabase
          .from('trades')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
          })
          .in('id', dbOpenTrades.map((t) => t.id));
      }

      return NextResponse.json({ success: true, symbol, amount, direction, closeOrder });
    }

    // --- CASE B: DATABASE TRADE ID CLOSURE (Standard trades) ---
    // Fetch trade details from Supabase
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

    // Isolate Sandbox Paper Trades from Binance API execution
    if (trade.is_paper) {
      let currentPrice = trade.entry_price;
      try {
        currentPrice = await fetchCurrentPrice(exchange, trade.pair);
      } catch (priceErr) {
        console.error('Failed to fetch price for paper trade closure:', priceErr);
      }

      const grossPnl = (currentPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);
      const entryFee = trade.entry_price * trade.amount * 0.0005;
      const exitFee = currentPrice * trade.amount * 0.0005;
      const realizedPnl = grossPnl - (entryFee + exitFee);

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
        return NextResponse.json({ error: `Database update error: ${updateErr.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, tradeId, isPaper: true });
    }

    // Fetch current price for final calculations
    const currentPrice = await fetchCurrentPrice(exchange, trade.pair);
    
    // Close position on Binance
    console.log(`Manually closing trade ${tradeId} for ${trade.pair}: size ${trade.amount}`);
    await closeActivePosition(exchange, trade.pair, trade.direction, trade.amount);

    // Calculate realized P&L (gross minus 0.05% entry and 0.05% exit taker fees)
    const grossPnl = (currentPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);
    const entryFee = trade.entry_price * trade.amount * 0.0005; // 0.05%
    const exitFee = currentPrice * trade.amount * 0.0005; // 0.05%
    const realizedPnl = grossPnl - (entryFee + exitFee);

    // Update Database
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

    // Fetch the new simulated balance
    const { data: allClosed } = await supabase
      .from('trades')
      .select('pnl')
      .eq('status', 'CLOSED');

    const netPnl = (allClosed || []).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const currentAccountBalance = 100.0 + netPnl;

    // Calculate duration
    const entryTime = new Date(trade.timestamp);
    const exitTime = new Date();
    const durationMs = exitTime.getTime() - entryTime.getTime();
    
    const totalSec = Math.floor(durationMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const durationStr = `${hrs > 0 ? `${hrs}h ` : ''}${mins > 0 ? `${mins}m ` : ''}${secs}s`;

    // Format dates using simple UTC strings for server reliability
    const entryTimeStr = entryTime.toUTCString();
    const exitTimeStr = exitTime.toUTCString();

    const tradeMargin = trade.margin ? parseFloat(trade.margin) : 10.0;
    const tradeLeverage = trade.leverage || 20;
    const totalSizeVal = tradeMargin * tradeLeverage;

    // Send Telegram Notification
    const pnlEmoji = realizedPnl >= 0 ? '🟢' : '🔴';
    const sign = realizedPnl >= 0 ? '+' : '';
    const formattedPnl = realizedPnl.toFixed(2);

    // Fetch Real Account Balance from Real keys in Settings
    let realBalanceText = 'Not Configured';
    const realKey = settings.binance_real_api_key || '';
    const realSecret = settings.binance_real_secret_key || '';
    if (realKey && realSecret) {
      try {
        const realExchange = getBinanceClient(realKey, realSecret, false);
        const realBal = await fetchFuturesBalance(realExchange);
        realBalanceText = `${realBal.toFixed(2)} USDT`;
      } catch (e: any) {
        realBalanceText = `Error: ${e.message}`;
      }
    }

    const msg = `${pnlEmoji} <b>TRADE CLOSED MANUALLY</b>\n` +
      `Pair: <b>${trade.pair}</b> ${trade.direction}\n` +
      `Margin: <b>${tradeMargin.toFixed(2)} USDT</b>\n` +
      `Leverage: <b>${tradeLeverage}x</b>\n` +
      `Total Size: <b>${totalSizeVal.toFixed(2)} USDT</b>\n` +
      `Exit Price: <b>${currentPrice}</b>\n` +
      `P&L: <b>${sign}${formattedPnl} USDT</b>\n` +
      `-----------------------------------\n` +
      `Start Time: <b>${entryTimeStr}</b>\n` +
      `End Time: <b>${exitTimeStr}</b>\n` +
      `Duration: <b>${durationStr}</b>\n` +
      `-----------------------------------\n` +
      `Demo Balance: <b>${currentAccountBalance.toFixed(2)} USDT</b>\n` +
      `Real Balance: <b>${realBalanceText}</b>`;

    await sendTelegramMessage(settings.telegram_token || '', settings.telegram_chat_id || '', msg);

    return NextResponse.json({ success: true, exitPrice: currentPrice, pnl: realizedPnl });
  } catch (err: any) {
    console.error('Failed to close trade:', err);
    return NextResponse.json({ error: err.message || 'Failed to close position' }, { status: 500 });
  }
}
