import { supabase } from './supabase';

export interface MartingaleConfig {
  enabled: boolean;
  allocated_capital: number;
  execution_mode: 'ONE_BY_ONE' | 'ALL_CONCURRENT';
  selected_pairs: string[];
  progression_steps: number[];
  progression_active_steps: boolean[];
}

export const DEFAULT_MARTINGALE_CONFIG: MartingaleConfig = {
  enabled: false,
  allocated_capital: 20.00,
  execution_mode: 'ONE_BY_ONE',
  selected_pairs: ['stpRNG', 'stpRNG2', 'stpRNG3', 'stpRNG4', 'stpRNG5', '1HZ30V', 'R_100', 'JD75', 'frxUSDJPY', 'frxAUDJPY'],
  progression_steps: [0.35, 0.39, 0.83, 1.75, 3.69, 7.79, 16.45, 34.73, 73.00, 150.00],
  progression_active_steps: [true, true, true, true, true, true, true, true, true, true]
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
  config: MartingaleConfig
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
    // 1. Fetch Martingale specific trades from database (stake < 0.99)
    const { data: martingaleTrades, error } = await supabase
      .from('deriv_trades')
      .select('*')
      .lt('stake', 0.99)
      .order('created_at', { ascending: false })
      .limit(30);

    // If ONE_BY_ONE mode is ON, check if ANY Martingale trade is currently OPEN
    if (config.execution_mode === 'ONE_BY_ONE' && martingaleTrades) {
      const openMartingaleTrade = martingaleTrades.find(t => t.status === 'OPEN');
      if (openMartingaleTrade) {
        return {
          stake: 0,
          stepIndex: 0,
          isHalted: false,
          isOpenBlocked: true,
          haltReason: `⏳ [One-by-One Lock] Martingale trade on ${openMartingaleTrade.symbol} is currently OPEN. Waiting for expiry before next entry.`
        };
      }
    }

    if (error || !martingaleTrades || martingaleTrades.length === 0) {
      return {
        stake: activeStepObjects[0].stake,
        stepIndex: activeStepObjects[0].originalIndex,
        isHalted: false
      };
    }

    // 2. Count consecutive losses starting from the most recently closed Martingale trade
    let consecutiveLosses = 0;
    for (const t of martingaleTrades) {
      if (t.status === 'OPEN') continue;

      const isLoss = t.status === 'LOST' || (t.pnl !== null && parseFloat(t.pnl) < 0);
      if (isLoss) {
        consecutiveLosses++;
      } else {
        // WIN or PnL >= 0 immediately resets streak to 0 (Step 1)
        break;
      }
    }

    // Check if consecutive losses exceeded or reached total active checked steps
    if (consecutiveLosses >= activeStepObjects.length) {
      return {
        stake: 0,
        stepIndex: -1,
        isHalted: true,
        haltReason: `🛑 [Progression Limit Reached] All ${activeStepObjects.length} active checked Martingale steps lost. Trading paused to protect allocated capital.`
      };
    }

    const currentStepObj = activeStepObjects[consecutiveLosses];
    return {
      stake: currentStepObj.stake,
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
