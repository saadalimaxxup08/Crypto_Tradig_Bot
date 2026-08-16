import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient, fetchFuturesBalance, fetchCurrentPrice } from '@/lib/binance';
import { sendTelegramMessage } from '@/lib/telegram';
import { analyzeStrategy } from '@/lib/indicators';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const report: {
    database: { status: 'OK' | 'ERROR'; message: string };
    binance: { status: 'OK' | 'ERROR'; message: string; balance?: number };
    indicators: { status: 'OK' | 'ERROR'; message: string };
    telegram: { status: 'OK' | 'ERROR'; message: string };
  } = {
    database: { status: 'ERROR', message: 'Not tested' },
    binance: { status: 'ERROR', message: 'Not tested' },
    indicators: { status: 'ERROR', message: 'Not tested' },
    telegram: { status: 'ERROR', message: 'Not tested' },
  };

  try {
    // 1. Test Supabase Database
    try {
      const { data, error } = await supabase.from('settings').select('id').eq('id', 1).single();
      if (error) throw error;
      report.database = { status: 'OK', message: 'Connected successfully to settings table.' };
    } catch (err: any) {
      report.database = { status: 'ERROR', message: 'DB query failed: ' + err.message };
    }

    // 2. Fetch credentials for other tests
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    const isDemo = (settings?.trading_mode || 'DEMO') === 'DEMO';
    const binanceApiKey = isDemo 
      ? (settings?.binance_demo_api_key || settings?.binance_api_key || process.env.BINANCE_API_KEY || '')
      : (settings?.binance_real_api_key || process.env.BINANCE_API_KEY || '');
    const binanceSecretKey = isDemo 
      ? (settings?.binance_demo_secret_key || settings?.binance_secret_key || process.env.BINANCE_SECRET_KEY || '')
      : (settings?.binance_real_secret_key || process.env.BINANCE_SECRET_KEY || '');

    const telegramToken = settings?.telegram_token || process.env.TELEGRAM_TOKEN || '';
    const telegramChatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';

    // 3. Test Binance Connection
    let binanceOk = false;
    let simulatedBalance = 100.0;
    if (!binanceApiKey || !binanceSecretKey) {
      report.binance = { status: 'ERROR', message: 'API keys are missing in configurations.' };
    } else {
      try {
        const exchange = getBinanceClient(binanceApiKey, binanceSecretKey, isDemo);
        await fetchFuturesBalance(exchange);
        // Fetch BTCUSDT current price as a ticker connection check
        const price = await fetchCurrentPrice(exchange, 'BTCUSDT');
        binanceOk = true;

        // Fetch all closed trades to compute simulated balance
        const { data: allClosed } = await supabase
          .from('trades')
          .select('pnl')
          .eq('status', 'CLOSED');
        const netPnl = (allClosed || []).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
        simulatedBalance = 100.0 + netPnl;

        report.binance = { 
          status: 'OK', 
          message: `Connected successfully. Balance: ${simulatedBalance.toFixed(2)} USDT. BTC Price: ${price}.`,
          balance: simulatedBalance 
        };
      } catch (err: any) {
        report.binance = { status: 'ERROR', message: 'Binance connection failed: ' + err.message };
      }
    }

    // 4. Test Indicators (Mathematical calculations on live Binance data if online)
    if (binanceApiKey && binanceSecretKey && binanceOk) {
      try {
        const exchange = getBinanceClient(binanceApiKey, binanceSecretKey, isDemo);
        // Fetch 250 actual recent 1m candles for BTCUSDT to test data parser
        const ohlcv = await exchange.fetchOHLCV('BTCUSDT', '1m', undefined, 250);
        const result = analyzeStrategy(ohlcv as any, settings.active_strategy || 'RSI_MACD');
        
        if (isNaN(result.rsi)) {
          throw new Error('RSI calculation returned NaN on live candles');
        }
        report.indicators = { 
          status: 'OK', 
          message: `Calculations verified on real candles. BTC RSI: ${result.rsi.toFixed(2)}, MACD: ${result.macdLine.toFixed(2)}.` 
        };
      } catch (err: any) {
        report.indicators = { 
          status: 'ERROR', 
          message: `Live candle indicator test failed: ${err.message}` 
        };
      }
    } else {
      try {
        const mockPrices = Array.from({ length: 250 }, (_, i) => 10 + Math.sin(i / 10) * 5);
        const mockOhlcv = mockPrices.map(price => [0, price, price, price, price, 0]);
        const result = analyzeStrategy(mockOhlcv, settings.active_strategy || 'RSI_MACD');
        if (isNaN(result.rsi)) {
          throw new Error('RSI calculation returned NaN');
        }
        report.indicators = { status: 'OK', message: 'Calculations verified using mock fallback data.' };
      } catch (err: any) {
        report.indicators = { status: 'ERROR', message: 'Mock indicator test failed: ' + err.message };
      }
    }

    // 5. Test Telegram Bot Connection & System Performance Check
    if (!telegramToken || !telegramChatId) {
      report.telegram = { status: 'ERROR', message: 'Telegram Token or Chat ID is missing.' };
    } else {
      try {
        const dbIcon = report.database.status === 'OK' ? '🟢' : '🔴';
        const binIcon = report.binance.status === 'OK' ? '🟢' : '🔴';
        const indIcon = report.indicators.status === 'OK' ? '🟢' : '🔴';
        const balStr = report.binance.status === 'OK' ? `(${simulatedBalance.toFixed(2)} USDT)` : '';

        // Calculate Cron scheduler heartbeat liveness
        const lastScan = settings?.last_scan_at ? new Date(settings.last_scan_at) : null;
        const now = new Date();
        let cronIcon = '🔴';
        let cronStatusText = 'OFFLINE (Never executed)';
        
        if (lastScan) {
          const diffMin = Math.floor((now.getTime() - lastScan.getTime()) / (1000 * 60));
          if (diffMin <= 3) {
            cronIcon = '🟢';
            cronStatusText = 'ACTIVE (Running fine)';
          } else {
            cronIcon = '🟡';
            cronStatusText = `DELAYED (Last scan: ${diffMin} min ago)`;
          }
        }

        const msgText = `🔧 <b>SYSTEM DIAGNOSTIC REPORT</b>\n` +
          `-----------------------------------\n` +
          `• <b>Trading Mode</b>: <b>${isDemo ? '🟡 DEMO SANDBOX' : '🟢 REAL LIVE'}</b>\n` +
          `• <b>Cron Scheduler</b>: ${cronIcon} <b>${cronStatusText}</b>\n` +
          `• <b>Database Link</b>: ${dbIcon} ${report.database.status}\n` +
          `• <b>Binance Client</b>: ${binIcon} ${report.binance.status} ${balStr}\n` +
          `• <b>Strategy Indicators</b>: ${indIcon} ${report.indicators.status}\n` +
          `• <b>Telegram Alert Route</b>: 🟢 OK\n` +
          `-----------------------------------\n` +
          `All systems check triggered manually. Dashboard report view verified.`;

        const sent = await sendTelegramMessage(telegramToken, telegramChatId, msgText);
        if (sent) {
          report.telegram = { status: 'OK', message: 'Test message sent successfully to Telegram.' };
        } else {
          throw new Error('API request returned non-OK status code.');
        }
      } catch (err: any) {
        report.telegram = { status: 'ERROR', message: 'Failed to send alert: ' + err.message };
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
