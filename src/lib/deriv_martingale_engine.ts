import { supabase } from './supabase';

export interface MartingaleConfig {
  enabled: boolean;
  allocated_capital: number;
  execution_mode: 'ONE_BY_ONE' | 'ALL_CONCURRENT';
  selected_pairs: string[];
  progression_steps: number[];
  progression_active_steps: boolean[];
  progression_mode?: 'USD' | 'PERCENTAGE';
  portfolio_price?: number;
  percentage_steps?: string[];
  auto_compound_enabled?: boolean;
}

export const DEFAULT_MARTINGALE_CONFIG: MartingaleConfig = {
  enabled: false,
  allocated_capital: 20.00,
  execution_mode: 'ONE_BY_ONE',
  selected_pairs: ['stpRNG', 'stpRNG2', 'stpRNG3', 'stpRNG4', 'stpRNG5', '1HZ30V', 'R_100', 'JD75', 'frxUSDJPY', 'frxAUDJPY'],
  progression_steps: [0.35, 0.40, 0.86, 1.83, 3.91, 8.36, 17.86, 38.15, 81.50, 174.12],
  progression_active_steps: [true, true, true, true, true, true, true, true, true, true],
  progression_mode: 'USD',
  portfolio_price: 20.00,
  percentage_steps: ['1.75', '1.95', '4.15', '8.75', '18.45', '38.95', '82.25', '173.65', '365.00', '750.00'],
  auto_compound_enabled: false
};

export interface MartingaleStakeResult {
  stake: number;
  stepIndex: number;
  isHalted: boolean;
  haltReason?: string;
  isOpenBlocked?: boolean;
}

/**
 * Calculates current Martingale progression stake and handles ONE_BY_ONE sequential blocking.
 */
export async function getMartingaleExecutionStake(
  config: MartingaleConfig,
  candidateSymbol?: string
): Promise<MartingaleStakeResult> {
  if (!config.enabled) {
    return { stake: 0, stepIndex: 0, isHalted: true, haltReason: 'Martingale Strategy Engine is set to OFF.' };
  }

  const steps = config.progression_steps || DEFAULT_MARTINGALE_CONFIG.progression_steps;
  const flags = config.progression_active_steps || DEFAULT_MARTINGALE_CONFIG.progression_active_steps;

  // Filter active checked steps
  const activeStepObjects: { originalIndex: number; stake: number }[] = [];
  steps.forEach((s, idx) => {
    if (flags[idx] && !isNaN(s) && s >= 0.35) {
      activeStepObjects.push({ originalIndex: idx, stake: s });
    }
  });

  if (activeStepObjects.length === 0) {
    return { stake: 0.35, stepIndex: 0, isHalted: false };
  }

  try {
    // 0. Fetch pair_overrides to check streak reset timestamp & starting step override
    const { data: settings } = await supabase.from('settings').select('pair_overrides').eq('id', 1).single();
    const ov = settings?.pair_overrides || {};
    const statsResetAt = ov.martingale_stats_reset_at ? new Date(ov.martingale_stats_reset_at).getTime() : 0;
    const streakResetAt = ov.martingale_streak_reset_at ? new Date(ov.martingale_streak_reset_at).getTime() : statsResetAt;
    const startStepIndex = typeof ov.martingale_start_step_index === 'number' ? ov.martingale_start_step_index : 0;

    // 1. Fetch Martingale specific trades from database (stake != 1.00)
    const { data: martingaleTrades, error } = await supabase
      .from('deriv_trades')
      .select('*')
      .neq('stake', 1.00)
      .order('created_at', { ascending: false })
      .limit(100);

    // If ONE_BY_ONE mode is ON, check if ANY Martingale trade is currently OPEN
    if (config.execution_mode === 'ONE_BY_ONE' && martingaleTrades) {
      const openMartingaleTrade = martingaleTrades.find(t => t.status === 'OPEN');
      if (openMartingaleTrade) {
        const openAgeMs = Date.now() - new Date(openMartingaleTrade.created_at).getTime();
        if (openAgeMs > 30 * 60 * 1000) {
          // Auto-expire stuck trade in DB if older than 30 minutes
          await supabase.from('deriv_trades').update({ status: 'LOST', closed_at: new Date().toISOString() }).eq('id', openMartingaleTrade.id);
        } else {
          return {
            stake: 0,
            stepIndex: 0,
            isHalted: false,
            isOpenBlocked: true,
            haltReason: `⏳ [One-by-One Lock] Martingale trade on ${openMartingaleTrade.symbol} is currently OPEN. Waiting for expiry before next entry.`
          };
        }
      }
    }

    if (error || !martingaleTrades || martingaleTrades.length === 0) {
      const initialIdx = Math.min(startStepIndex, activeStepObjects.length - 1);
      return {
        stake: activeStepObjects[initialIdx]?.stake || 0.35,
        stepIndex: activeStepObjects[initialIdx]?.originalIndex || 0,
        isHalted: false
      };
    }

    // 2. Count consecutive losses & calculate PnL starting from trades after statsResetAt
    let consecutiveLossesSinceReset = 0;
    let totalPnL = 0;
    let streakActive = true;
    let lastLossTime = 0;

    // Optional per-pair symbol isolation: filter trades for candidateSymbol if provided
    const filteredTrades = candidateSymbol 
      ? martingaleTrades.filter(t => t.symbol === candidateSymbol || t.status === 'OPEN') 
      : martingaleTrades;

    for (const t of filteredTrades) {
      if (t.status === 'OPEN') continue;
      const tradeTime = new Date(t.created_at).getTime();

      if (statsResetAt > 0 && tradeTime < statsResetAt) {
        // Trade occurred before user reset all stats, ignore for PnL!
        continue;
      }

      if (t.status === 'WON' || t.status === 'LOST') {
        totalPnL += (parseFloat(t.pnl) || 0);
      }

      if (streakResetAt > 0 && tradeTime < streakResetAt) {
        // Trade occurred before user reset streak, ignore for loss counting!
        continue;
      }

      const isLoss = t.status === 'LOST' || (t.pnl !== null && parseFloat(t.pnl) < 0);
      if (isLoss && streakActive) {
        if (lastLossTime === 0) {
          lastLossTime = tradeTime;
        }
        consecutiveLossesSinceReset++;
      } else {
        streakActive = false; // WIN or PnL >= 0 resets streak
      }
    }

    // ⏱️ STREAK EXPIRATION GUARD: If the most recent loss happened > 45 minutes ago, expire loss streak back to Step 1!
    const STREAK_EXPIRY_MS = 45 * 60 * 1000; // 45 minutes
    if (lastLossTime > 0 && (Date.now() - lastLossTime > STREAK_EXPIRY_MS)) {
      consecutiveLossesSinceReset = 0;
    }

    const effectiveStepPos = startStepIndex + consecutiveLossesSinceReset;

    // Check if consecutive losses exceeded or reached total active checked steps
    if (effectiveStepPos >= activeStepObjects.length) {
      return {
        stake: 0,
        stepIndex: -1,
        isHalted: true,
        haltReason: `🛑 [Progression Limit Reached] All ${activeStepObjects.length} active checked Martingale steps lost. Trading paused to protect allocated capital.`
      };
    }

    const currentStepObj = activeStepObjects[effectiveStepPos];
    let finalStake = currentStepObj.stake;

    // 3. Auto-Compounding & Live Balance Distribution across active selected steps
    if (config.auto_compound_enabled === true) {
      const baseCapital = Number(config.allocated_capital) || Number(config.portfolio_price) || 20.00;
      const activeBalance = Math.max(0.35, baseCapital + totalPnL);

      let activeBaseSum = 0;
      activeStepObjects.forEach(obj => {
        activeBaseSum += obj.stake;
      });

      if (config.progression_mode === 'PERCENTAGE' && config.percentage_steps && config.percentage_steps[currentStepObj.originalIndex]) {
        const pct = parseFloat(config.percentage_steps[currentStepObj.originalIndex]) || 0;
        finalStake = Math.max(0.35, Math.round((activeBalance * (pct / 100)) * 100) / 100);
      } else if (activeBaseSum > 0) {
        if (effectiveStepPos === activeStepObjects.length - 1 && activeStepObjects.length > 1) {
          // Last active step consumes 100% of remaining balance to prevent 1-cent rounding shortfall
          let precedingSum = 0;
          for (let i = 0; i < effectiveStepPos; i++) {
            const ratio = activeStepObjects[i].stake / activeBaseSum;
            precedingSum += Math.max(0.35, Math.round((activeBalance * ratio) * 100) / 100);
          }
          finalStake = Math.max(0.35, Math.round((activeBalance - precedingSum) * 100) / 100);
        } else {
          const stepRatio = currentStepObj.stake / activeBaseSum;
          finalStake = Math.max(0.35, Math.round((activeBalance * stepRatio) * 100) / 100);
        }
      }
    }

    return {
      stake: finalStake,
      stepIndex: currentStepObj.originalIndex,
      isHalted: false
    };
  } catch (err: any) {
    console.error('Error computing Martingale execution stake:', err);
    return {
      stake: activeStepObjects[0].stake,
      stepIndex: activeStepObjects[0].originalIndex,
      isHalted: false
    };
  }
}
