import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    const overrides = settings?.pair_overrides || {};
    const botEnabled = overrides.deriv_bot_enabled !== undefined ? overrides.deriv_bot_enabled : (settings?.deriv_bot_enabled || false);
    const lastScanAt = overrides.deriv_last_scan_at || '';
    const lastScanLogs = overrides.deriv_last_scan_logs || [];

    // Calculate Today's P&L from deriv_trades
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const { data: todayTrades } = await supabase
      .from('deriv_trades')
      .select('pnl, status')
      .gte('timestamp', startOfToday.toISOString());

    let todayPnl = 0;
    if (todayTrades) {
      todayPnl = todayTrades.reduce((acc, trade) => acc + (parseFloat(trade.pnl) || 0), 0);
    }

    // Calculate Win Rate from closed deriv_trades
    const { data: closedTrades } = await supabase
      .from('deriv_trades')
      .select('pnl')
      .eq('status', 'CLOSED');

    let totalClosed = 0;
    let winCount = 0;

    if (closedTrades) {
      totalClosed = closedTrades.length;
      winCount = closedTrades.filter((t) => (parseFloat(t.pnl) || 0) > 0).length;
    }

    const winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;

    return NextResponse.json({
      botEnabled,
      balanceFetched: true,
      balanceError: null,
      realBalance: 0,
      todayPnl,
      totalTrades: totalClosed,
      winRate: Math.round(winRate * 10) / 10,
      lastScanAt,
      lastScanLogs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
