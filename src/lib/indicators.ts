/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  if (prices.length < period) return ema;

  const k = 2 / (period + 1);

  // Initial SMA as the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  let currentEma = sum / period;
  
  // Fill preceding indices with null/undefined equivalent or start array at period - 1
  for (let i = 0; i < period - 1; i++) {
    ema.push(NaN); // Use NaN to align array indexes with input
  }
  ema.push(currentEma);

  for (let i = period; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    ema.push(currentEma);
  }

  return ema;
}

/**
 * Calculate Relative Strength Index (RSI) using Wilder's Smoothing
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  if (prices.length <= period) {
    return new Array(prices.length).fill(NaN);
  }

  // Pre-fill with NaN for indices where RSI cannot be computed
  for (let i = 0; i <= period; i++) {
    rsi.push(NaN);
  }

  let gains = 0;
  let losses = 0;

  // First gain/loss calculation
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // First RSI value at index `period` (after `period` changes, i.e., at element `period`)
  // Wait, let's make sure the alignment is correct.
  // Period diffs exist between index 0 and index period (which is period + 1 elements).
  // Yes, prices[period] - prices[period-1] is the last difference.
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
}

/**
 * Calculate Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  const macdLine: number[] = [];
  const len = prices.length;

  // Align MACD line with input prices
  for (let i = 0; i < len; i++) {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
  }

  // Calculate Signal line which is EMA of the MACD line
  // We need to filter out NaNs to compute the EMA, but maintain indexing alignment
  const validMacdLine = macdLine.filter((v) => !isNaN(v));
  const validSignalLine = calculateEMA(validMacdLine, signalPeriod);

  const signalLine: number[] = [];
  let signalIdx = 0;

  for (let i = 0; i < len; i++) {
    if (isNaN(macdLine[i])) {
      signalLine.push(NaN);
    } else {
      signalLine.push(validSignalLine[signalIdx] ?? NaN);
      signalIdx++;
    }
  }

  const histogram: number[] = [];
  for (let i = 0; i < len; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Analyze technical indicators and determine buy/sell signals using RSI + MACD momentum strategy.
 */
export function analyzeRsiMacd(prices: number[]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const rsi = calculateRSI(prices, 14);
  const { macdLine, signalLine } = calculateMACD(prices, 12, 26, 9);

  const len = prices.length;
  if (len < 30) {
    return { rsi: NaN, macdLine: NaN, signalLine: NaN, direction: 'NEUTRAL' };
  }

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const currentRsi = rsi[currentIdx];
  const currentMacd = macdLine[currentIdx];
  const currentSignal = signalLine[currentIdx];

  const prevMacd = macdLine[prevIdx];
  const prevSignal = signalLine[prevIdx];

  if (
    isNaN(currentRsi) ||
    isNaN(currentMacd) ||
    isNaN(currentSignal) ||
    isNaN(prevMacd) ||
    isNaN(prevSignal)
  ) {
    return { rsi: currentRsi, macdLine: currentMacd, signalLine: currentSignal, direction: 'NEUTRAL' };
  }

  // Bullish Cross: MACD line crossed above Signal line
  const isBullishCross = prevMacd <= prevSignal && currentMacd > currentSignal;

  // Bearish Cross: MACD line crossed below Signal line
  const isBearishCross = prevMacd >= prevSignal && currentMacd < currentSignal;

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (currentRsi < 30 && isBullishCross) {
    direction = 'LONG';
  } else if (currentRsi > 70 && isBearishCross) {
    direction = 'SHORT';
  }

  return {
    rsi: currentRsi,
    macdLine: currentMacd,
    signalLine: currentSignal,
    direction,
  };
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  const len = prices.length;

  if (len < period) {
    const nans = new Array(len).fill(NaN);
    return { upper: nans, middle: nans, lower: nans };
  }

  for (let i = 0; i < len; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      middle.push(NaN);
      lower.push(NaN);
      continue;
    }

    const windowSlice = prices.slice(i - period + 1, i + 1);
    const sma = windowSlice.reduce((sum, p) => sum + p, 0) / period;
    const variance = windowSlice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    middle.push(sma);
    upper.push(sma + multiplier * stdDev);
    lower.push(sma - multiplier * stdDev);
  }

  return { upper, middle, lower };
}

/**
 * Bollinger Bands + RSI Range Reversion Strategy
 */
export function analyzeBollingerRsi(prices: number[]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = prices.length;
  if (len < 30) {
    return { rsi: NaN, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const rsi = calculateRSI(prices, 14);
  const { upper, lower } = calculateBollingerBands(prices, 20, 2);

  const currentIdx = len - 1;
  const currentRsi = rsi[currentIdx];
  const currentPrice = prices[currentIdx];
  const currentUpper = upper[currentIdx];
  const currentLower = lower[currentIdx];

  if (isNaN(currentRsi) || isNaN(currentUpper) || isNaN(currentLower)) {
    return { rsi: currentRsi, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice <= currentLower && currentRsi <= 35) {
    direction = 'LONG';
  } else if (currentPrice >= currentUpper && currentRsi >= 65) {
    direction = 'SHORT';
  }

  return {
    rsi: currentRsi,
    macdLine: 0,
    signalLine: 0,
    direction,
  };
}

/**
 * Double EMA Crossover Trend Following Strategy (EMA 9 & 21)
 */
export function analyzeDoubleEma(prices: number[]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = prices.length;
  if (len < 30) {
    return { rsi: NaN, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const rsi = calculateRSI(prices, 14);

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const cEma9 = ema9[currentIdx];
  const cEma21 = ema21[currentIdx];
  const pEma9 = ema9[prevIdx];
  const pEma21 = ema21[prevIdx];
  const currentRsi = rsi[currentIdx] || 50;

  if (isNaN(cEma9) || isNaN(cEma21) || isNaN(pEma9) || isNaN(pEma21)) {
    return { rsi: currentRsi, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (pEma9 <= pEma21 && cEma9 > cEma21) {
    direction = 'LONG';
  } else if (pEma9 >= pEma21 && cEma9 < cEma21) {
    direction = 'SHORT';
  }

  return {
    rsi: currentRsi,
    macdLine: cEma9,
    signalLine: cEma21,
    direction,
  };
}

/**
 * Main Dispatcher Strategy analysis function.
 */
export function analyzeStrategy(
  prices: number[],
  strategy: string = 'RSI_MACD'
): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  if (strategy === 'BOLLINGER_RSI') {
    return analyzeBollingerRsi(prices);
  } else if (strategy === 'DOUBLE_EMA') {
    return analyzeDoubleEma(prices);
  } else {
    return analyzeRsiMacd(prices);
  }
}
