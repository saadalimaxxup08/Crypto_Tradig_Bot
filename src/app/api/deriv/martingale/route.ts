import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { DEFAULT_MARTINGALE_CONFIG } from '@/lib/deriv_martingale_engine';

export const dynamic = 'force-dynamic';

let balanceCache: { demoBalance: number; realBalance: number; timestamp: number } | null = null;

async function getDerivBalances(appId: string, token: string) {
  const now = Date.now();
  if (balanceCache && (now - balanceCache.timestamp < 35000)) {
    return { demoBalance: balanceCache.demoBalance, realBalance: balanceCache.realBalance };
  }

  if (!appId || !token) {
    return balanceCache ? { demoBalance: balanceCache.demoBalance, realBalance: balanceCache.realBalance } : { demoBalance: 0.00, realBalance: 0.00 };
  }

  try {
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      method: 'GET',
      headers: {
        'Deriv-App-ID': appId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (response.status === 200) {
      const resData = await response.json();
      if (resData && resData.data) {
        const demo = resData.data.find((a: any) => a.account_type === 'demo');
        const real = resData.data.find((a: any) => a.account_type === 'real');
        const demoBalance = demo ? parseFloat(demo.balance) : (balanceCache?.demoBalance || 0.00);
        const realBalance = real ? parseFloat(real.balance) : (balanceCache?.realBalance || 0.00);

        balanceCache = { demoBalance, realBalance, timestamp: Date.now() };
        return { demoBalance, realBalance };
      }
    } else {
      console.warn(`Deriv balances HTTP ${response.status} in martingale route: Rate limit or error response. Using cached balance.`);
    }
  } catch (e) {
    console.error("Failed to fetch Deriv balances in martingale route:", e);
  }
  return balanceCache ? { demoBalance: balanceCache.demoBalance, realBalance: balanceCache.realBalance } : { demoBalance: 0.00, realBalance: 0.00 };
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
      selected_strategies: Array.isArray(ov.martingale_active_strategies) ? ov.martingale_active_strategies : (ov.deriv_active_strategies || ['FOREX_15M_PRO_V1', 'FOREX_15M_MTF', 'FOREX_15M_MTF_V2', 'FOREX_30M_MTF_V3']),
      selected_pairs: Array.isArray(ov.martingale_selected_pairs) ? ov.martingale_selected_pairs : DEFAULT_MARTINGALE_CONFIG.selected_pairs,
      progression_steps: Array.isArray(ov.deriv_progression_steps) ? ov.deriv_progression_steps : DEFAULT_MARTINGALE_CONFIG.progression_steps,
      progression_active_steps: Array.isArray(ov.deriv_progression_active_steps) ? ov.deriv_progression_active_steps : DEFAULT_MARTINGALE_CONFIG.progression_active_steps
    };

    // Fetch Martingale stats from deriv_trades (essential columns only, limit 200 for complete historical stats)
    const { data: martingaleTrades } = await supabase
      .from('deriv_trades')
      .select('id, symbol, contract_type, stake, payout, status, entry_price, exit_price, pnl, created_at, closed_at')
      .neq('stake', 1.00)
      .order('created_at', { ascending: false })
      .limit(200);

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
      } else if (t.status === 'OPEN') {
        openCount++;
      }
    });

    // Check if any trade is currently OPEN
    const currentOpenTrade = tradesList.find(t => t.status === 'OPEN');

    // Calculate current consecutive losses on Martingale engine from closed trades
    let consecutiveLosses = 0;
    for (const t of tradesList) {
      if (t.status === 'OPEN') continue;
      if (t.status === 'LOST' || (t.pnl !== null && parseFloat(t.pnl) < 0)) {
        consecutiveLosses++;
      } else {
        break; // WIN resets streak
      }
    }

    const activeStepFlags = config.progression_active_steps || [];
    const activeIndices: number[] = [];
    activeStepFlags.forEach((active: boolean, idx: number) => {
      if (active) activeIndices.push(idx);
    });

    let currentStepIndex = 0;
    if (currentOpenTrade) {
      const stepsArr = config.progression_steps || DEFAULT_MARTINGALE_CONFIG.progression_steps;
      const matchingIdx = stepsArr.findIndex((s: number) => Math.abs(s - currentOpenTrade.stake) < 0.02);
      if (matchingIdx !== -1) {
        currentStepIndex = matchingIdx;
      } else if (activeIndices.length > 0) {
        const activePos = Math.min(consecutiveLosses, activeIndices.length - 1);
        currentStepIndex = activeIndices[activePos];
      }
    } else if (activeIndices.length > 0) {
      const activePos = Math.min(consecutiveLosses, activeIndices.length - 1);
      currentStepIndex = activeIndices[activePos];
    }

    const winRate = (wonCount + lostCount) > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0;

    const riskFilters = {
      news: ov.martingale_news_filter_enabled !== undefined ? ov.martingale_news_filter_enabled !== false : (ov.deriv_news_filter_enabled !== false),
      session: ov.martingale_session_filter_enabled !== undefined ? ov.martingale_session_filter_enabled !== false : (ov.deriv_session_filter_enabled !== false),
      cooldown: ov.martingale_cooldown_filter_enabled !== undefined ? ov.martingale_cooldown_filter_enabled !== false : (ov.deriv_cooldown_filter_enabled !== false),
      daily: ov.martingale_daily_limit_enabled !== undefined ? ov.martingale_daily_limit_enabled !== false : (ov.deriv_daily_limit_enabled !== false),
      pairLossCooldown: ov.martingale_pair_loss_cooldown_enabled !== undefined ? ov.martingale_pair_loss_cooldown_enabled !== false : (ov.deriv_pair_loss_cooldown_enabled !== false),
      pairRotationGuard: ov.martingale_pair_rotation_guard_enabled !== undefined ? ov.martingale_pair_rotation_guard_enabled !== false : (ov.deriv_pair_rotation_guard_enabled !== false)
    };

    const openTradesList = tradesList.filter(t => t.status === 'OPEN');

    return NextResponse.json({
      success: true,
      config,
      riskFilters,
      nearEntryPairs: ov.martingale_near_entry_pairs || [],
      lastScanLogs: ov.martingale_last_scan_logs || [],
      lastScanAt: ov.martingale_last_scan_at || '',
      stats: {
        totalTrades: tradesList.length,
        wonCount,
        lostCount,
        openCount,
        totalPnL,
        winRate,
        consecutiveLosses,
        currentStepIndex,
        nextStake: (config.progression_steps && config.progression_steps[currentStepIndex]) || 0.35,
        allocatedCapital: config.allocated_capital || 20.00,
        demoBalance,
        realBalance,
        activeBalance: config.trading_mode === 'REAL' ? realBalance : demoBalance
      },
      openTrades: openTradesList,
      recentTrades: tradesList.slice(0, 100)
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
      selected_strategies,
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
      martingale_active_strategies: Array.isArray(selected_strategies) ? selected_strategies : (currentOv.martingale_active_strategies || ['FOREX_15M_PRO_V1', 'FOREX_15M_MTF', 'FOREX_15M_MTF_V2', 'FOREX_30M_MTF_V3']),
      martingale_selected_pairs: Array.isArray(selected_pairs) ? selected_pairs : (currentOv.martingale_selected_pairs || DEFAULT_MARTINGALE_CONFIG.selected_pairs),
      deriv_progression_steps: Array.isArray(progression_steps) ? progression_steps : (currentOv.deriv_progression_steps || DEFAULT_MARTINGALE_CONFIG.progression_steps),
      deriv_progression_active_steps: Array.isArray(progression_active_steps) ? progression_active_steps : (currentOv.deriv_progression_active_steps || DEFAULT_MARTINGALE_CONFIG.progression_active_steps),
      martingale_news_filter_enabled: riskFilters?.news !== undefined ? Boolean(riskFilters.news) : (currentOv.martingale_news_filter_enabled !== undefined ? currentOv.martingale_news_filter_enabled !== false : (currentOv.deriv_news_filter_enabled !== false)),
      martingale_session_filter_enabled: riskFilters?.session !== undefined ? Boolean(riskFilters.session) : (currentOv.martingale_session_filter_enabled !== undefined ? currentOv.martingale_session_filter_enabled !== false : (currentOv.deriv_session_filter_enabled !== false)),
      martingale_cooldown_filter_enabled: riskFilters?.cooldown !== undefined ? Boolean(riskFilters.cooldown) : (currentOv.martingale_cooldown_filter_enabled !== undefined ? currentOv.martingale_cooldown_filter_enabled !== false : (currentOv.deriv_cooldown_filter_enabled !== false)),
      martingale_daily_limit_enabled: riskFilters?.daily !== undefined ? Boolean(riskFilters.daily) : (currentOv.martingale_daily_limit_enabled !== undefined ? currentOv.martingale_daily_limit_enabled !== false : (currentOv.deriv_daily_limit_enabled !== false)),
      martingale_pair_loss_cooldown_enabled: riskFilters?.pairLossCooldown !== undefined ? Boolean(riskFilters.pairLossCooldown) : (currentOv.martingale_pair_loss_cooldown_enabled !== undefined ? currentOv.martingale_pair_loss_cooldown_enabled !== false : (currentOv.deriv_pair_loss_cooldown_enabled !== false)),
      martingale_pair_rotation_guard_enabled: riskFilters?.pairRotationGuard !== undefined ? Boolean(riskFilters.pairRotationGuard) : (currentOv.martingale_pair_rotation_guard_enabled !== undefined ? currentOv.martingale_pair_rotation_guard_enabled !== false : (currentOv.deriv_pair_rotation_guard_enabled !== false))
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
        news: updatedOv.martingale_news_filter_enabled !== false,
        session: updatedOv.martingale_session_filter_enabled !== false,
        cooldown: updatedOv.martingale_cooldown_filter_enabled !== false,
        daily: updatedOv.martingale_daily_limit_enabled !== false,
        pairLossCooldown: updatedOv.martingale_pair_loss_cooldown_enabled !== false,
        pairRotationGuard: updatedOv.martingale_pair_rotation_guard_enabled !== false
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
