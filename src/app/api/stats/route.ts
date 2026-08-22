import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { getBinanceClient, fetchFuturesBalance } from '@/lib/binance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch settings to get bot_enabled, credentials, and last scan logs
    const { data: settings } = await supabase
      .from('settings')
      .select('bot_enabled, binance_api_key, binance_secret_key, trading_mode, binance_demo_api_key, binance_demo_secret_key, binance_real_api_key, binance_real_secret_key, last_scan_at, last_scan_logs')
      .eq('id', 1)
      .single();

    const botEnabled = settings?.bot_enabled || false;
    const lastScanAt = settings?.last_scan_at || null;
    const lastScanLogs = settings?.last_scan_logs || [];

    // 2. Connect to Binance (Credential and connection check based on active mode)
    let balanceFetched = false;
    let balanceError = '';
    let realBalance = 0;

    const isDemo = (settings?.trading_mode || 'DEMO') === 'DEMO';
    const binance_api_key = isDemo 
      ? (settings?.binance_demo_api_key || settings?.binance_api_key || '')
      : (settings?.binance_real_api_key || '');
    const binance_secret_key = isDemo 
      ? (settings?.binance_demo_secret_key || settings?.binance_secret_key || '')
      : (settings?.binance_real_secret_key || '');

    if (binance_api_key && binance_secret_key) {
      try {
        const exchange = getBinanceClient(
          binance_api_key,
          binance_secret_key,
          isDemo
        );
        // Test connection by fetching balance (verifies API key viability)
        realBalance = await fetchFuturesBalance(exchange);
        balanceFetched = true;
      } catch (err: any) {
        balanceError = err.message;
        console.error('Failed to verify Binance connection:', err);
      }
    }

    // 3. Calculate Today's P&L
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const { data: todayTrades } = await supabase
      .from('trades')
      .select('pnl, binance_order_id')
      .eq('status', 'CLOSED')
      .eq('is_paper', false)
      .gte('closed_at', startOfToday.toISOString());

    const filteredTodayTrades = (todayTrades || []).filter(t => 
      isDemo ? (t.binance_order_id || '').startsWith('DEMO_') : !(t.binance_order_id || '').startsWith('DEMO_')
    );

    const todayPnl = filteredTodayTrades.reduce(
      (sum, t) => sum + parseFloat(t.pnl || 0),
      0
    );

    // 4. Calculate Win Rate
    const { data: allClosedTrades } = await supabase
      .from('trades')
      .select('pnl, binance_order_id')
      .eq('status', 'CLOSED')
      .eq('is_paper', false);

    const filteredClosedTrades = (allClosedTrades || []).filter(t => 
      isDemo ? (t.binance_order_id || '').startsWith('DEMO_') : !(t.binance_order_id || '').startsWith('DEMO_')
    );

    const totalClosed = filteredClosedTrades.length;
    const wins = filteredClosedTrades.filter((t) => parseFloat(t.pnl || 0) > 0).length;
    const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;

    // 5. Get current open trades count
    const { data: allOpenTrades } = await supabase
      .from('trades')
      .select('binance_order_id')
      .eq('status', 'OPEN')
      .eq('is_paper', false);

    const filteredOpenTrades = (allOpenTrades || []).filter(t => 
      isDemo ? (t.binance_order_id || '').startsWith('DEMO_') : !(t.binance_order_id || '').startsWith('DEMO_')
    );
    const openTradesCount = filteredOpenTrades.length;

    const netHistoricalPnl = filteredClosedTrades.reduce(
      (sum, t) => sum + parseFloat(t.pnl || 0),
      0
    );
    let balance = 0;
    if (balanceFetched) {
      balance = realBalance;
    } else {
      balance = isDemo ? (5000.0 + netHistoricalPnl) : (100.0 + netHistoricalPnl);
    }

    return NextResponse.json({
      success: true,
      botEnabled,
      balance,
      realBalance,
      balanceFetched,
      balanceError,
      todayPnl,
      winRate,
      openTradesCount: openTradesCount || 0,
      lastScanAt,
      lastScanLogs,
      tradingMode: settings?.trading_mode || 'DEMO',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
