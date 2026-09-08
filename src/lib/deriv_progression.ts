import { supabase } from './supabase';

/**
 * Calculates the current progression step and effective stake amount.
 * If progression mode is OFF, returns default base stake.
 * If progression mode is ON, checks consecutive losses of closed trades.
 * Resets back to Step 1 ($0.35 or steps[0]) as soon as any trade WINS.
 */
export async function getEffectiveProgressionStake(
  overrides: any,
  defaultBaseStake: number
): Promise<{ stake: number; stepIndex: number; isProgressionActive: boolean }> {
  const isEnabled = overrides?.deriv_progression_enabled === true;
  if (!isEnabled) {
    return { stake: defaultBaseStake, stepIndex: 0, isProgressionActive: false };
  }

  const rawSteps = overrides?.deriv_progression_steps;
  const steps: number[] = Array.isArray(rawSteps) && rawSteps.length === 10
    ? rawSteps.map(s => parseFloat(s) || 0.35)
    : [0.35, 0.39, 0.83, 1.75, 3.69, 7.79, 16.45, 34.73, 73.00, 150.00];

  try {
    // Fetch last 20 closed trades ordered by created_at descending
    const { data: recentTrades, error } = await supabase
      .from('deriv_trades')
      .select('status, pnl, closed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !recentTrades || recentTrades.length === 0) {
      return { stake: steps[0], stepIndex: 0, isProgressionActive: true };
    }

    let consecutiveLosses = 0;
    for (const t of recentTrades) {
      if (t.status === 'OPEN') continue; // Skip active open positions
      
      const isLoss = t.status === 'LOST' || (t.pnl !== null && parseFloat(t.pnl) < 0);
      if (isLoss) {
        consecutiveLosses++;
      } else {
        // WIN or PnL >= 0 immediately resets the martingale back to Step 1 (Index 0)
        break;
      }
    }

    const stepIndex = Math.min(consecutiveLosses, steps.length - 1);
    const stake = steps[stepIndex] || steps[0];

    return { stake, stepIndex, isProgressionActive: true };
  } catch (err) {
    console.error('Error computing progression stake:', err);
    return { stake: steps[0], stepIndex: 0, isProgressionActive: true };
  }
}
