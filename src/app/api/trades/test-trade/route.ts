import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient, fetchCurrentPrice, fetchFuturesBalance } from '@/lib/binance';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Settings configuration not found.' }, { status: 400 });
    }

    const isDemo = (settings.trading_mode || 'DEMO') === 'DEMO';
    const binance_api_key = isDemo 
      ? (settings.binance_demo_api_key || settings.binance_api_key || '')
      : (settings.binance_real_api_key || '');
    const binance_secret_key = isDemo 
      ? (settings.binance_demo_secret_key || settings.binance_secret_key || '')
      : (settings.binance_real_secret_key || '');

    if (!binance_api_key || !binance_secret_key) {
      return NextResponse.json({ error: 'Binance API credentials missing.' }, { status: 400 });
    }

    const telegram_token = settings.telegram_token || '';
    const telegram_chat_id = settings.telegram_chat_id || '';
    const leverage = settings.leverage || 20;

    // 2. Initialize Binance client
    const exchange = getBinanceClient(binance_api_key, binance_secret_key, isDemo);

    // Set leverage on Binance prior to trade
    try {
      await exchange.setLeverage(leverage, 'BTCUSDT');
    } catch (e: any) {
      console.warn('Could not set leverage on Binance:', e.message);
    }

    const entryPrice = await fetchCurrentPrice(exchange, 'BTCUSDT');
    // Minimum contract size for BTCUSDT is 0.001 BTC
    const amount = 0.001; 
    const entryTime = new Date();

    // 3. Open Test Position (Market BUY)
    console.log(`Executing test trade BUY for BTCUSDT: size ${amount}`);
    let buyOrder;
    try {
      buyOrder = await exchange.createMarketBuyOrder('BTCUSDT', amount);
    } catch (err: any) {
      const errorMsg = `Failed to open test position: ${err.message}`;
      if (telegram_token && telegram_chat_id) {
        await sendTelegramMessage(
          telegram_token,
          telegram_chat_id,
          `⚠️ <b>TEST TRADE FAILED</b>\nError: <code>${err.message}</code>`
        );
      }
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Save initial trade to Supabase DB as OPEN
    const tradeMargin = (amount * entryPrice) / leverage;
    const { data: dbTrade, error: dbError } = await supabase
      .from('trades')
      .insert([{
        pair: 'BTCUSDT',
        direction: 'LONG',
        amount: amount,
        entry_price: entryPrice,
        status: 'OPEN',
        leverage: leverage,
        margin: tradeMargin,
        created_at: entryTime.toISOString()
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Failed to log test trade to DB:', dbError.message);
    }

    // Send Alert to Telegram
    if (telegram_token && telegram_chat_id) {
      const openMsg = `🧪 <b>TEST TRADE EXECUTION STARTED</b>\n` +
        `-----------------------------------\n` +
        `Mode: <b>${isDemo ? '🟡 DEMO SANDBOX' : '🟢 REAL LIVE'}</b>\n` +
        `Pair: <b>BTCUSDT LONG</b>\n` +
        `Margin: <b>${tradeMargin.toFixed(2)} USDT</b>\n` +
        `Leverage: <b>${leverage}x</b>\n` +
        `Size: <b>${(amount * entryPrice).toFixed(2)} USDT (${amount} BTC)</b>\n` +
        `Entry Price: <b>${entryPrice}</b>\n` +
        `Time: <b>${entryTime.toUTCString()}</b>\n` +
        `-----------------------------------\n` +
        `Position will be closed immediately in 1 second.`;
      await sendTelegramMessage(telegram_token, telegram_chat_id, openMsg);
    }

    // 4. Wait 1 second (1000ms) before closing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 5. Close Test Position (Market SELL)
    const exitPrice = await fetchCurrentPrice(exchange, 'BTCUSDT');
    const exitTime = new Date();
    
    console.log(`Executing test trade SELL to close for BTCUSDT: size ${amount}`);
    let sellOrder;
    try {
      sellOrder = await exchange.createMarketSellOrder('BTCUSDT', amount);
    } catch (err: any) {
      const errorMsg = `Test position opened but failed to close: ${err.message}. Please close it manually on Binance!`;
      if (telegram_token && telegram_chat_id) {
        await sendTelegramMessage(
          telegram_token,
          telegram_chat_id,
          `🚨 <b>CRITICAL: TEST TRADE CLOSE FAILED</b>\nError: <code>${err.message}</code>\n<b>Please close the 0.001 BTC LONG position manually on Binance!</b>`
        );
      }
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // 6. Calculate P&L and fees
    // Binance taker fee is 0.05%
    const entryFee = amount * entryPrice * 0.0005;
    const exitFee = amount * exitPrice * 0.0005;
    const totalFees = entryFee + exitFee;
    const grossPnl = (exitPrice - entryPrice) * amount;
    const netRealizedPnl = grossPnl - totalFees;

    // Calculate duration details
    const durationSec = Math.max(1, Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000));
    const durationStr = `${durationSec}s`;

    // Fetch current wallet balance to show net balance
    let currentAccountBalance = 100.0;
    try {
      // Calculate simulated balance: 100 + historical P&L
      const { data: allClosed } = await supabase
        .from('trades')
        .select('pnl')
        .eq('status', 'CLOSED');
      const histPnl = (allClosed || []).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
      currentAccountBalance = 100.0 + histPnl + netRealizedPnl;
    } catch {}

    // 7. Update DB Trade to CLOSED
    if (dbTrade?.id) {
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          status: 'CLOSED',
          exit_price: exitPrice,
          pnl: netRealizedPnl,
          closed_at: exitTime.toISOString()
        })
        .eq('id', dbTrade.id);
      
      if (updateError) {
        console.error('Failed to update test trade in DB:', updateError.message);
      }
    }

    // 8. Send Telegram Notification
    if (telegram_token && telegram_chat_id) {
      const pnlEmoji = netRealizedPnl >= 0 ? '🟢' : '🔴';
      const sign = netRealizedPnl >= 0 ? '+' : '';
      const closeMsg = `🧪 <b>TEST TRADE SUCCESSFULLY CLOSED</b>\n` +
        `-----------------------------------\n` +
        `Mode: <b>${isDemo ? '🟡 DEMO SANDBOX' : '🟢 REAL LIVE'}</b>\n` +
        `Pair: <b>BTCUSDT LONG</b>\n` +
        `Exit Price: <b>${exitPrice}</b>\n` +
        `Fees Deducted: <b>${totalFees.toFixed(4)} USDT</b>\n` +
        `Net P&L: <b>${sign}${netRealizedPnl.toFixed(4)} USDT</b> ${pnlEmoji}\n` +
        `-----------------------------------\n` +
        `Start Time: <b>${entryTime.toUTCString()}</b>\n` +
        `End Time: <b>${exitTime.toUTCString()}</b>\n` +
        `Duration: <b>${durationStr}</b>\n` +
        `-----------------------------------\n` +
        `Account Balance: <b>${currentAccountBalance.toFixed(2)} USDT</b>`;
      await sendTelegramMessage(telegram_token, telegram_chat_id, closeMsg);
    }

    return NextResponse.json({
      success: true,
      entryPrice,
      exitPrice,
      pnl: netRealizedPnl,
      message: 'Test trade executed and closed successfully!'
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
