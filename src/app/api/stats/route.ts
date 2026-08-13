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
    // 1. Fetch settings to get bot_enabled and credentials
    const { data: settings } = await supabase
      .from('settings')
      .select('bot_enabled, binance_api_key, binance_secret_key')
      .eq('id', 1)
      .single();

    const botEnabled = settings?.bot_enabled || false;

    // 2. Fetch live Binance Testnet balance
    let balance = 100.0; // Fallback default
    let balanceFetched = false;
    let balanceError = '';

    if (settings?.binance_api_key && settings?.binance_secret_key) {
      try {
        const exchange = getBinanceClient(
          settings.binance_api_key,
          settings.binance_secret_key
        );
        balance = await fetchFuturesBalance(exchange);
        balanceFetched = true;
      } catch (err: any) {
        balanceError = err.message;
        console.error('Failed to fetch live balance:', err);
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

    return NextResponse.json({
      success: true,
      botEnabled,
      balance,
      balanceFetched,
      balanceError,
      todayPnl,
      winRate,
      openTradesCount: openTradesCount || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
