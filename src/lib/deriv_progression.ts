import { supabase } from './supabase';

export interface ProgressionResult {
  stake: number;
  stepIndex: number;
  isProgressionActive: boolean;
  isHalted: boolean;
  haltReason?: string;
}

/**
 * Calculates the current progression step and effective stake amount.
 * Only checked/active steps are considered.
 * If all checked steps are lost consecutively, trading is HALTED for safety.
 * As soon as any trade WINS, consecutive losses reset to 0 (Step 1).
 */
export async function getEffectiveProgressionStake(
  overrides: any,
  defaultBaseStake: number
): Promise<ProgressionResult> {
  const isEnabled = overrides?.deriv_progression_enabled === true;
  if (!isEnabled) {
    return { stake: defaultBaseStake, stepIndex: 0, isProgressionActive: false, isHalted: false };
  }

  const rawSteps = overrides?.deriv_progression_steps;
  const rawActiveFlags = overrides?.deriv_progression_active_steps;

  const defaultSteps = [0.35, 0.39, 0.83, 1.75, 3.69, 7.79, 16.45, 34.73, 73.00, 150.00];
  const defaultFlags = [true, true, true, true, true, true, true, true, true, true];

  const steps: number[] = Array.isArray(rawSteps) && rawSteps.length === 10
    ? rawSteps.map(s => parseFloat(s) || 0.35)
    : defaultSteps;

  const flags: boolean[] = Array.isArray(rawActiveFlags) && rawActiveFlags.length === 10
    ? rawActiveFlags.map(f => Boolean(f))
    : defaultFlags;

  // Filter only enabled/ticked steps
  const activeStepObjects: { originalIndex: number; stake: number }[] = [];
  steps.forEach((s, idx) => {
    if (flags[idx] && !isNaN(s) && s >= 0.35) {
      activeStepObjects.push({ originalIndex: idx, stake: s });
    }
  });

  if (activeStepObjects.length === 0) {
    // If no steps checked, fallback to base stake
    return { stake: defaultBaseStake, stepIndex: 0, isProgressionActive: false, isHalted: false };
  }

  try {
    // Fetch last 20 closed trades ordered by created_at descending
    const { data: recentTrades, error } = await supabase
      .from('deriv_trades')
      .select('status, pnl, closed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !recentTrades || recentTrades.length === 0) {
      return {
        stake: activeStepObjects[0].stake,
        stepIndex: activeStepObjects[0].originalIndex,
        isProgressionActive: true,
        isHalted: false
      };
    }

    let consecutiveLosses = 0;
    for (const t of recentTrades) {
      if (t.status === 'OPEN') continue; // Skip active open positions
      
      const isLoss = t.status === 'LOST' || (t.pnl !== null && parseFloat(t.pnl) < 0);
      if (isLoss) {
        consecutiveLosses++;
      } else {
        // WIN or PnL >= 0 immediately resets the streak back to 0 (Step 1)
        break;
      }
    }

    // Check if consecutive losses exceeded or reached total active checked steps
    if (consecutiveLosses >= activeStepObjects.length) {
      return {
        stake: 0,
        stepIndex: -1,
        isProgressionActive: true,
        isHalted: true,
        haltReason: `⛔ [Progression Limit Reached] All ${activeStepObjects.length} active checked steps lost consecutively. Trading paused to protect balance.`
      };
    }

    const currentStepObj = activeStepObjects[consecutiveLosses];
    return {
      stake: currentStepObj.stake,
      stepIndex: currentStepObj.originalIndex,
      isProgressionActive: true,
      isHalted: false
    };
  } catch (err: any) {
    console.error('Error computing progression stake:', err);
    return {
      stake: activeStepObjects[0].stake,
      stepIndex: activeStepObjects[0].originalIndex,
      isProgressionActive: true,
      isHalted: false
    };
  }
}
