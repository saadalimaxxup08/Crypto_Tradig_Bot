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
      .select('bot_enabled, binance_api_key, binance_secret_key, last_scan_at, last_scan_logs')
      .eq('id', 1)
      .single();

    const botEnabled = settings?.bot_enabled || false;
    const lastScanAt = settings?.last_scan_at || null;
    const lastScanLogs = settings?.last_scan_logs || [];

    // 2. Connect to Binance Testnet (Credential and connection check)
    let balanceFetched = false;
    let balanceError = '';

    if (settings?.binance_api_key && settings?.binance_secret_key) {
      try {
        const exchange = getBinanceClient(
          settings.binance_api_key,
          settings.binance_secret_key
        );
        // Test connection by fetching balance (verifies API key viability)
        await fetchFuturesBalance(exchange);
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
      .select('pnl')
      .eq('status', 'CLOSED')
      .gte('closed_at', startOfToday.toISOString());

    const todayPnl = (todayTrades || []).reduce(
      (sum, t) => sum + parseFloat(t.pnl || 0),
      0
    );

    // 4. Calculate Win Rate
    const { data: allClosedTrades } = await supabase
      .from('trades')
      .select('pnl')
      .eq('status', 'CLOSED');

    const totalClosed = allClosedTrades?.length || 0;
    const wins = allClosedTrades?.filter((t) => parseFloat(t.pnl || 0) > 0).length || 0;
    const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;

    // 5. Get current open trades count
    const { count: openTradesCount } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'OPEN');

    // 6. Calculate Simulated Account Balance (Starting Capital 100 USDT + Net Historical P&L)
    const netHistoricalPnl = (allClosedTrades || []).reduce(
      (sum, t) => sum + parseFloat(t.pnl || 0),
      0
    );
    const balance = 100.0 + netHistoricalPnl;

    return NextResponse.json({
      success: true,
      botEnabled,
      balance,
      balanceFetched,
      balanceError,
      todayPnl,
      winRate,
      openTradesCount: openTradesCount || 0,
      lastScanAt,
      lastScanLogs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
