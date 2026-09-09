import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { DEFAULT_MARTINGALE_CONFIG } from '@/lib/deriv_martingale_engine';

export const dynamic = 'force-dynamic';

async function getDerivBalances(appId: string, token: string) {
  try {
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      method: 'GET',
      headers: {
        'Deriv-App-ID': appId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      const resData = await response.json();
      if (resData && resData.data) {
        const demo = resData.data.find((a: any) => a.account_type === 'demo');
        const real = resData.data.find((a: any) => a.account_type === 'real');
        return {
          demoBalance: demo ? parseFloat(demo.balance) : 0.00,
          realBalance: real ? parseFloat(real.balance) : 0.00
        };
      }
    }
  } catch (e) {
    console.error("Failed to fetch Deriv balances in martingale route:", e);
  }
  return { demoBalance: 0.00, realBalance: 0.00 };
}

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('deriv_app_id, deriv_api_token, pair_overrides')
      .eq('id', 1)
      .single();

    const appId = settings?.deriv_app_id || process.env.DERIV_APP_ID || '';
    const token = settings?.deriv_api_token || process.env.DERIV_API_TOKEN || '';
    const ov = settings?.pair_overrides || {};

    let demoBalance = 0.00;
    let realBalance = 0.00;
    if (appId && token) {
      const balances = await getDerivBalances(appId, token);
      demoBalance = balances.demoBalance;
      realBalance = balances.realBalance;
    }

    const config = {
      enabled: ov.deriv_progression_enabled === true,
      trading_mode: ov.martingale_trading_mode || 'DEMO',
      allocated_capital: ov.martingale_allocated_capital !== undefined ? parseFloat(ov.martingale_allocated_capital) : 20.00,
      execution_mode: ov.martingale_execution_mode || 'ONE_BY_ONE',
      selected_pairs: Array.isArray(ov.martingale_selected_pairs) ? ov.martingale_selected_pairs : DEFAULT_MARTINGALE_CONFIG.selected_pairs,
      progression_steps: Array.isArray(ov.deriv_progression_steps) ? ov.deriv_progression_steps : DEFAULT_MARTINGALE_CONFIG.progression_steps,
      progression_active_steps: Array.isArray(ov.deriv_progression_active_steps) ? ov.deriv_progression_active_steps : DEFAULT_MARTINGALE_CONFIG.progression_active_steps
    };

    // Fetch Martingale stats from deriv_trades
    const { data: martingaleTrades } = await supabase
      .from('deriv_trades')
      .select('*')
      .eq('strategy_engine', 'MARTINGALE_ENGINE')
      .order('created_at', { ascending: false });

    const tradesList = martingaleTrades || [];
    let totalPnL = 0;
    let wonCount = 0;
    let lostCount = 0;
    let openCount = 0;

    tradesList.forEach(t => {
      if (t.status === 'WON') {
        wonCount++;
        totalPnL += (parseFloat(t.pnl) || 0);
      } else if (t.status === 'LOST') {
        lostCount++;
        totalPnL += (parseFloat(t.pnl) || 0);
      } else {
        openCount++;
      }
    });

    const winRate = (wonCount + lostCount) > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

    const riskFilters = {
      news: ov.deriv_news_filter_enabled !== false,
      session: ov.deriv_session_filter_enabled !== false,
      cooldown: ov.deriv_cooldown_filter_enabled !== false,
      daily: ov.deriv_daily_limit_enabled !== false
    };

    const openTradesList = tradesList.filter(t => t.status === 'OPEN');

    return NextResponse.json({
      success: true,
      config,
      riskFilters,
      stats: {
        totalTrades: tradesList.length,
        wonCount,
        lostCount,
        openCount,
        totalPnL,
        winRate,
        allocatedCapital: config.allocated_capital || 20.00,
        demoBalance,
        realBalance,
        activeBalance: config.trading_mode === 'REAL' ? realBalance : demoBalance
      },
      openTrades: openTradesList,
      recentTrades: tradesList.slice(0, 50)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      enabled,
      trading_mode,
      allocated_capital,
      execution_mode,
      selected_pairs,
      progression_steps,
      progression_active_steps,
      riskFilters
    } = body;

    const { data: currentSettings } = await supabase
      .from('settings')
      .select('pair_overrides')
      .eq('id', 1)
      .single();

    const currentOv = currentSettings?.pair_overrides || {};

    const updatedOv = {
      ...currentOv,
      deriv_progression_enabled: enabled !== undefined ? Boolean(enabled) : (currentOv.deriv_progression_enabled === true),
      martingale_trading_mode: trading_mode || currentOv.martingale_trading_mode || 'DEMO',
      martingale_allocated_capital: allocated_capital !== undefined ? parseFloat(allocated_capital) : (currentOv.martingale_allocated_capital || 20.00),
      martingale_execution_mode: execution_mode || currentOv.martingale_execution_mode || 'ONE_BY_ONE',
      martingale_selected_pairs: Array.isArray(selected_pairs) ? selected_pairs : (currentOv.martingale_selected_pairs || DEFAULT_MARTINGALE_CONFIG.selected_pairs),
      deriv_progression_steps: Array.isArray(progression_steps) ? progression_steps : (currentOv.deriv_progression_steps || DEFAULT_MARTINGALE_CONFIG.progression_steps),
      deriv_progression_active_steps: Array.isArray(progression_active_steps) ? progression_active_steps : (currentOv.deriv_progression_active_steps || DEFAULT_MARTINGALE_CONFIG.progression_active_steps),
      deriv_news_filter_enabled: riskFilters?.news !== undefined ? Boolean(riskFilters.news) : (currentOv.deriv_news_filter_enabled !== false),
      deriv_session_filter_enabled: riskFilters?.session !== undefined ? Boolean(riskFilters.session) : (currentOv.deriv_session_filter_enabled !== false),
      deriv_cooldown_filter_enabled: riskFilters?.cooldown !== undefined ? Boolean(riskFilters.cooldown) : (currentOv.deriv_cooldown_filter_enabled !== false),
      deriv_daily_limit_enabled: riskFilters?.daily !== undefined ? Boolean(riskFilters.daily) : (currentOv.deriv_daily_limit_enabled !== false)
    };

    const { error } = await supabase
      .from('settings')
      .update({
        pair_overrides: updatedOv
      })
      .eq('id', 1);

    if (error) {
      console.error('Failed to update settings in Supabase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const config = {
      enabled: updatedOv.deriv_progression_enabled === true,
      trading_mode: updatedOv.martingale_trading_mode,
      allocated_capital: updatedOv.martingale_allocated_capital,
      execution_mode: updatedOv.martingale_execution_mode,
      selected_pairs: updatedOv.martingale_selected_pairs,
      progression_steps: updatedOv.deriv_progression_steps,
      progression_active_steps: updatedOv.deriv_progression_active_steps
    };

    return NextResponse.json({
      success: true,
      config,
      riskFilters: {
        news: updatedOv.deriv_news_filter_enabled !== false,
        session: updatedOv.deriv_session_filter_enabled !== false,
        cooldown: updatedOv.deriv_cooldown_filter_enabled !== false,
        daily: updatedOv.deriv_daily_limit_enabled !== false
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
