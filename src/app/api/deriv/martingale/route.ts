import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { DEFAULT_MARTINGALE_CONFIG } from '@/lib/deriv_martingale_engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('martingale_config, pair_overrides')
      .eq('id', 1)
      .single();

    let config = settings?.martingale_config || DEFAULT_MARTINGALE_CONFIG;
    
    // Fallback merge with pair_overrides if martingale_config not created yet
    if (!settings?.martingale_config && settings?.pair_overrides) {
      const ov = settings.pair_overrides;
      config = {
        enabled: ov.deriv_progression_enabled === true,
        allocated_capital: ov.martingale_allocated_capital || 20.00,
        execution_mode: ov.martingale_execution_mode || 'ONE_BY_ONE',
        selected_pairs: ov.martingale_selected_pairs || DEFAULT_MARTINGALE_CONFIG.selected_pairs,
        progression_steps: ov.deriv_progression_steps || DEFAULT_MARTINGALE_CONFIG.progression_steps,
        progression_active_steps: ov.deriv_progression_active_steps || DEFAULT_MARTINGALE_CONFIG.progression_active_steps
      };
    }

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

    const ov = settings?.pair_overrides || {};
    const riskFilters = {
      news: ov.deriv_news_filter_enabled !== false,
      session: ov.deriv_session_filter_enabled !== false,
      cooldown: ov.deriv_cooldown_filter_enabled !== false,
      daily: ov.deriv_daily_limit_enabled !== false
    };

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
        allocatedCapital: config.allocated_capital || 20.00
      },
      recentTrades: tradesList.slice(0, 15)
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
      allocated_capital,
      execution_mode,
      selected_pairs,
      progression_steps,
      progression_active_steps,
      riskFilters
    } = body;

    const { data: currentSettings } = await supabase
      .from('settings')
      .select('martingale_config, pair_overrides')
      .eq('id', 1)
      .single();

    const currentConfig = currentSettings?.martingale_config || DEFAULT_MARTINGALE_CONFIG;

    const updatedConfig = {
      enabled: enabled !== undefined ? Boolean(enabled) : currentConfig.enabled,
      allocated_capital: allocated_capital !== undefined ? parseFloat(allocated_capital) : currentConfig.allocated_capital,
      execution_mode: execution_mode || currentConfig.execution_mode,
      selected_pairs: Array.isArray(selected_pairs) ? selected_pairs : currentConfig.selected_pairs,
      progression_steps: Array.isArray(progression_steps) ? progression_steps : currentConfig.progression_steps,
      progression_active_steps: Array.isArray(progression_active_steps) ? progression_active_steps : currentConfig.progression_active_steps
    };

    const currentOv = currentSettings?.pair_overrides || {};
    const updatedOv = {
      ...currentOv,
      martingale_allocated_capital: updatedConfig.allocated_capital,
      martingale_execution_mode: updatedConfig.execution_mode,
      martingale_selected_pairs: updatedConfig.selected_pairs,
      deriv_progression_enabled: updatedConfig.enabled,
      deriv_progression_steps: updatedConfig.progression_steps,
      deriv_progression_active_steps: updatedConfig.progression_active_steps,
      ...(riskFilters ? {
        deriv_news_filter_enabled: riskFilters.news !== undefined ? Boolean(riskFilters.news) : (currentOv.deriv_news_filter_enabled !== false),
        deriv_session_filter_enabled: riskFilters.session !== undefined ? Boolean(riskFilters.session) : (currentOv.deriv_session_filter_enabled !== false),
        deriv_cooldown_filter_enabled: riskFilters.cooldown !== undefined ? Boolean(riskFilters.cooldown) : (currentOv.deriv_cooldown_filter_enabled !== false),
        deriv_daily_limit_enabled: riskFilters.daily !== undefined ? Boolean(riskFilters.daily) : (currentOv.deriv_daily_limit_enabled !== false)
      } : {})
    };

    // Update settings table
    const { error } = await supabase
      .from('settings')
      .update({
        martingale_config: updatedConfig,
        pair_overrides: updatedOv
      })
      .eq('id', 1);

    if (error) {
      await supabase
        .from('settings')
        .update({
          pair_overrides: updatedOv
        })
        .eq('id', 1);
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig,
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
