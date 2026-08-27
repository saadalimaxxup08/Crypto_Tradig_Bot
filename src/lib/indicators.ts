/**
 * Global Strategy Portfolio Dispatcher Map
 * Maps winning pairs to their designated top performing strategies.
 */
export const COMBINATION_MAP: Record<string, string> = {
  'SUIUSDT': 'BOLLINGER_RSI_OPT',
  'ETHUSDT': 'ICHIMOKU_CLOUDBREAK',
  'ARBUSDT': 'ICHIMOKU_CLOUDBREAK',
  'SEIUSDT': 'BOLLINGER_RSI_OPT',
  'BTCUSDT': 'ICHIMOKU_CLOUDBREAK',
  'LINKUSDT': 'DOUBLE_EMA_5M',
  'GALAUSDT': 'DOUBLE_EMA_5M',
  'LDOUSDT': 'ICHIMOKU_CLOUDBREAK'
};

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
  const len = prices.length;
  if (len < 205) {
    return { rsi: NaN, macdLine: NaN, signalLine: NaN, direction: 'NEUTRAL' };
  }

  const rsi = calculateRSI(prices, 14);
  const { macdLine, signalLine } = calculateMACD(prices, 12, 26, 9);
  const ema200 = calculateEMA(prices, 200);

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const currentRsi = rsi[currentIdx];
  const currentMacd = macdLine[currentIdx];
  const currentSignal = signalLine[currentIdx];
  const currentEma200 = ema200[currentIdx];

  const prevMacd = macdLine[prevIdx];
  const prevSignal = signalLine[prevIdx];

  if (
    isNaN(currentRsi) ||
    isNaN(currentMacd) ||
    isNaN(currentSignal) ||
    isNaN(prevMacd) ||
    isNaN(prevSignal) ||
    isNaN(currentEma200)
  ) {
    return { rsi: currentRsi, macdLine: currentMacd, signalLine: currentSignal, direction: 'NEUTRAL' };
  }

  // Bullish Cross: MACD line crossed above Signal line
  const isBullishCross = prevMacd <= prevSignal && currentMacd > currentSignal;

  // Bearish Cross: MACD line crossed below Signal line
  const isBearishCross = prevMacd >= prevSignal && currentMacd < currentSignal;

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (currentRsi < 30 && isBullishCross && prices[currentIdx] > currentEma200) {
    direction = 'LONG';
  } else if (currentRsi > 70 && isBearishCross && prices[currentIdx] < currentEma200) {
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
export function analyzeDoubleEma(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 205) {
    return { rsi: NaN, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema200 = calculateEMA(closes, 200);
  const adx = calculateADX(highs, lows, closes, 14);
  const rsi = calculateRSI(closes, 14);

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const cEma9 = ema9[currentIdx];
  const cEma21 = ema21[currentIdx];
  const pEma9 = ema9[prevIdx];
  const pEma21 = ema21[prevIdx];
  const currentRsi = rsi[currentIdx] || 50;
  const currentEma200 = ema200[currentIdx];
  const currentAdx = adx[currentIdx];

  if (
    isNaN(cEma9) ||
    isNaN(cEma21) ||
    isNaN(pEma9) ||
    isNaN(pEma21) ||
    isNaN(currentEma200) ||
    isNaN(currentAdx)
  ) {
    return { rsi: currentRsi, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  // 1. Calculate 1-Hour Trend Alignment
  let trend1h: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 200) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema50_1h = calculateEMA(closes1h, 50);
    const ema200_1h = calculateEMA(closes1h, 200);
    const currentEma50_1h = ema50_1h[ema50_1h.length - 1];
    const currentEma200_1h = ema200_1h[ema200_1h.length - 1];
    if (!isNaN(currentEma50_1h) && !isNaN(currentEma200_1h)) {
      trend1h = currentEma50_1h > currentEma200_1h ? 'LONG' : 'SHORT';
    }
  }

  // 2. Calculate Volume Confirmation
  const volSma = calculateVolumeSMA(ohlcv, 20);
  const currentVolume = ohlcv[currentIdx][5];
  const currentVolSma = volSma[currentIdx];
  const isVolumeConfirmed = isNaN(currentVolSma) || (currentVolume >= 1.5 * currentVolSma);

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentAdx > 22 && isVolumeConfirmed) {
    if (pEma9 <= pEma21 && cEma9 > cEma21 && closes[currentIdx] > currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'LONG') {
        direction = 'LONG';
      }
    } else if (pEma9 >= pEma21 && cEma9 < cEma21 && closes[currentIdx] < currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'SHORT') {
        direction = 'SHORT';
      }
    }
  }

  return {
    rsi: currentAdx, // Return ADX value
    macdLine: cEma9,
    signalLine: cEma21,
    direction,
  };
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const len = closes.length;
  const tr: number[] = [highs[0] - lows[0]];

  for (let i = 1; i < len; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  const atr: number[] = new Array(len).fill(NaN);
  if (len < period) return atr;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  atr[period - 1] = sum / period;

  for (let i = period; i < len; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  return atr;
}

/**
 * Calculate Average Directional Index (ADX) using Wilder's smoothing
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const len = closes.length;
  const adx: number[] = new Array(len).fill(NaN);
  if (len < 2 * period) return adx;

  const tr: number[] = [highs[0] - lows[0]];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < len; i++) {
    // True Range
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));

    // DM+ and DM-
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
  }

  const smoothedTR: number[] = new Array(len).fill(NaN);
  const smoothedPlusDM: number[] = new Array(len).fill(NaN);
  const smoothedMinusDM: number[] = new Array(len).fill(NaN);

  let sumTR = 0;
  let sumPlus = 0;
  let sumMinus = 0;

  for (let i = 0; i < period; i++) {
    sumTR += tr[i];
    sumPlus += plusDM[i];
    sumMinus += minusDM[i];
  }

  smoothedTR[period - 1] = sumTR;
  smoothedPlusDM[period - 1] = sumPlus;
  smoothedMinusDM[period - 1] = sumMinus;

  for (let i = period; i < len; i++) {
    smoothedTR[i] = smoothedTR[i - 1] - (smoothedTR[i - 1] / period) + tr[i];
    smoothedPlusDM[i] = smoothedPlusDM[i - 1] - (smoothedPlusDM[i - 1] / period) + plusDM[i];
    smoothedMinusDM[i] = smoothedMinusDM[i - 1] - (smoothedMinusDM[i - 1] / period) + minusDM[i];
  }

  const dx: number[] = new Array(len).fill(NaN);
  for (let i = period - 1; i < len; i++) {
    const trVal = smoothedTR[i];
    if (trVal === 0) {
      dx[i] = 0;
      continue;
    }
    const plusDI = 100 * (smoothedPlusDM[i] / trVal);
    const minusDI = 100 * (smoothedMinusDM[i] / trVal);
    const sumDI = plusDI + minusDI;
    const diffDI = Math.abs(plusDI - minusDI);
    dx[i] = sumDI === 0 ? 0 : (diffDI / sumDI) * 100;
  }

  let sumDX = 0;
  for (let i = period - 1; i < 2 * period - 1; i++) {
    sumDX += dx[i];
  }
  adx[2 * period - 2] = sumDX / period;

  for (let i = 2 * period - 1; i < len; i++) {
    adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
  }

  return adx;
}

/**
 * Calculate SMA of the volume column
 */
export function calculateVolumeSMA(ohlcv: number[][], period: number = 20): number[] {
  const len = ohlcv.length;
  const sma: number[] = new Array(len).fill(NaN);
  if (len < period) return sma;

  const volumes = ohlcv.map(c => c[5]);
  for (let i = period - 1; i < len; i++) {
    const slice = volumes.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, v) => acc + v, 0);
    sma[i] = sum / period;
  }

  return sma;
}


/**
 * Calculate Stochastic RSI
 */
export function calculateStochRSI(
  rsi: number[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): { k: number[]; d: number[] } {
  const len = rsi.length;
  const stochRsi: number[] = new Array(len).fill(NaN);
  
  for (let i = period - 1; i < len; i++) {
    const windowSlice = rsi.slice(i - period + 1, i + 1);
    const validValues = windowSlice.filter(v => !isNaN(v));
    if (validValues.length < period) continue;

    const minRsi = Math.min(...validValues);
    const maxRsi = Math.max(...validValues);
    const diff = maxRsi - minRsi;
    
    if (diff === 0) {
      stochRsi[i] = 100;
    } else {
      stochRsi[i] = ((rsi[i] - minRsi) / diff) * 100;
    }
  }

  // Smooth to K line
  const k: number[] = new Array(len).fill(NaN);
  for (let i = smoothK - 1; i < len; i++) {
    const slice = stochRsi.slice(i - smoothK + 1, i + 1);
    const valid = slice.filter(v => !isNaN(v));
    if (valid.length < smoothK) continue;
    k[i] = valid.reduce((sum, v) => sum + v, 0) / smoothK;
  }

  // Smooth to D line
  const d: number[] = new Array(len).fill(NaN);
  for (let i = smoothD - 1; i < len; i++) {
    const slice = k.slice(i - smoothD + 1, i + 1);
    const valid = slice.filter(v => !isNaN(v));
    if (valid.length < smoothD) continue;
    d[i] = valid.reduce((sum, v) => sum + v, 0) / smoothD;
  }

  return { k, d };
}

/**
 * SuperTrend + 200 EMA strategy
 */
export function analyzeSuperTrendEma(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 205) {
    return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const ema200 = calculateEMA(closes, 200);
  const atr = calculateATR(highs, lows, closes, 10);
  const adx = calculateADX(highs, lows, closes, 14);

  const multiplier = 3;
  const trends: (string | null)[] = new Array(len).fill(null);
  const finalUpper: number[] = new Array(len).fill(NaN);
  const finalLower: number[] = new Array(len).fill(NaN);

  const startIdx = 10;
  finalUpper[startIdx] = (highs[startIdx] + lows[startIdx]) / 2 + multiplier * atr[startIdx];
  finalLower[startIdx] = (highs[startIdx] + lows[startIdx]) / 2 - multiplier * atr[startIdx];
  trends[startIdx] = 'LONG';

  for (let i = startIdx + 1; i < len; i++) {
    const basicUpper = (highs[i] + lows[i]) / 2 + multiplier * atr[i];
    const basicLower = (highs[i] + lows[i]) / 2 - multiplier * atr[i];

    if (basicUpper < finalUpper[i - 1] || closes[i - 1] > finalUpper[i - 1]) {
      finalUpper[i] = basicUpper;
    } else {
      finalUpper[i] = finalUpper[i - 1];
    }

    if (basicLower > finalLower[i - 1] || closes[i - 1] < finalLower[i - 1]) {
      finalLower[i] = basicLower;
    } else {
      finalLower[i] = finalLower[i - 1];
    }

    if (closes[i] > finalUpper[i]) {
      trends[i] = 'LONG';
    } else if (closes[i] < finalLower[i]) {
      trends[i] = 'SHORT';
    } else {
      trends[i] = trends[i - 1] || 'LONG';
    }
  }

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const currentTrend = trends[currentIdx];
  const prevTrend = trends[prevIdx];
  const currentClose = closes[currentIdx];
  const currentEma200 = ema200[currentIdx];
  const currentAdx = adx[currentIdx];

  // 1. Calculate 1-Hour Trend Alignment
  let trend1h: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 200) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema50_1h = calculateEMA(closes1h, 50);
    const ema200_1h = calculateEMA(closes1h, 200);
    const currentEma50_1h = ema50_1h[ema50_1h.length - 1];
    const currentEma200_1h = ema200_1h[ema200_1h.length - 1];
    if (!isNaN(currentEma50_1h) && !isNaN(currentEma200_1h)) {
      trend1h = currentEma50_1h > currentEma200_1h ? 'LONG' : 'SHORT';
    }
  }

  // 2. Calculate Volume Confirmation
  const volSma = calculateVolumeSMA(ohlcv, 20);
  const currentVolume = ohlcv[currentIdx][5];
  const currentVolSma = volSma[currentIdx];
  const isVolumeConfirmed = isNaN(currentVolSma) || (currentVolume >= 1.5 * currentVolSma);

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentAdx > 22 && isVolumeConfirmed) {
    if (prevTrend === 'SHORT' && currentTrend === 'LONG' && currentClose > currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'LONG') {
        direction = 'LONG';
      }
    } else if (prevTrend === 'LONG' && currentTrend === 'SHORT' && currentClose < currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'SHORT') {
        direction = 'SHORT';
      }
    }
  }

  return {
    rsi: currentAdx || 0, // Store ADX value in rsi space for UI reference
    macdLine: currentClose,
    signalLine: currentEma200,
    direction,
  };
}

/**
 * Stochastic RSI + MACD Momentum strategy
 */
export function analyzeStochRsiMacd(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 205) {
    return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const closes = ohlcv.map(c => c[4]);
  const rsi = calculateRSI(closes, 14);
  const { k, d } = calculateStochRSI(rsi, 14, 3, 3);
  const { macdLine, signalLine, histogram } = calculateMACD(closes, 12, 26, 9);
  const ema200 = calculateEMA(closes, 200);

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const kCurr = k[currentIdx];
  const dCurr = d[currentIdx];
  const kPrev = k[prevIdx];
  const dPrev = d[prevIdx];
  const histCurr = histogram[currentIdx];
  const currentEma200 = ema200[currentIdx];

  if (isNaN(kCurr) || isNaN(dCurr) || isNaN(kPrev) || isNaN(dPrev) || isNaN(histCurr) || isNaN(currentEma200)) {
    return { rsi: rsi[currentIdx] || 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  // Long: StochRSI bullish crossover in oversold (<20) AND MACD histogram positive AND above EMA 200
  if (kPrev <= dPrev && kCurr > dCurr && kCurr < 20 && histCurr > 0 && closes[currentIdx] > currentEma200) {
    direction = 'LONG';
  }
  // Short: StochRSI bearish crossover in overbought (>80) AND MACD histogram negative AND below EMA 200
  else if (kPrev >= dPrev && kCurr < dCurr && kCurr > 80 && histCurr < 0 && closes[currentIdx] < currentEma200) {
    direction = 'SHORT';
  }

  return {
    rsi: kCurr, // Return StochRSI %K as rsi parameter for UI representation
    macdLine: macdLine[currentIdx],
    signalLine: signalLine[currentIdx],
    direction,
  };
}

/**
 * ATR Channel Breakout strategy
 */
export function analyzeAtrBreakout(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 205) {
    return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const ema20 = calculateEMA(closes, 20);
  const ema200 = calculateEMA(closes, 200);
  const atr = calculateATR(highs, lows, closes, 14);
  const adx = calculateADX(highs, lows, closes, 14);

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const currentClose = closes[currentIdx];
  const prevClose = closes[prevIdx];
  const currentEma20 = ema20[currentIdx];
  const currentAtr = atr[currentIdx];
  const prevEma20 = ema20[prevIdx];
  const prevAtr = atr[prevIdx];
  const currentEma200 = ema200[currentIdx];
  const currentAdx = adx[currentIdx];

  if (
    isNaN(currentEma20) ||
    isNaN(currentAtr) ||
    isNaN(prevEma20) ||
    isNaN(prevAtr) ||
    isNaN(currentEma200) ||
    isNaN(currentAdx)
  ) {
    return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  // 1. Calculate 1-Hour Trend Alignment
  let trend1h: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 200) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema50_1h = calculateEMA(closes1h, 50);
    const ema200_1h = calculateEMA(closes1h, 200);
    const currentEma50_1h = ema50_1h[ema50_1h.length - 1];
    const currentEma200_1h = ema200_1h[ema200_1h.length - 1];
    if (!isNaN(currentEma50_1h) && !isNaN(currentEma200_1h)) {
      trend1h = currentEma50_1h > currentEma200_1h ? 'LONG' : 'SHORT';
    }
  }

  // 2. Calculate Volume Confirmation
  const volSma = calculateVolumeSMA(ohlcv, 20);
  const currentVolume = ohlcv[currentIdx][5];
  const currentVolSma = volSma[currentIdx];
  const isVolumeConfirmed = isNaN(currentVolSma) || (currentVolume >= 1.5 * currentVolSma);

  const upperBandCurrent = currentEma20 + 2 * currentAtr;
  const lowerBandCurrent = currentEma20 - 2 * currentAtr;
  const upperBandPrev = prevEma20 + 2 * prevAtr;
  const lowerBandPrev = prevEma20 - 2 * prevAtr;

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentAdx > 22 && isVolumeConfirmed) {
    if (prevClose <= upperBandPrev && currentClose > upperBandCurrent && currentClose > currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'LONG') {
        direction = 'LONG';
      }
    } else if (prevClose >= lowerBandPrev && currentClose < lowerBandCurrent && currentClose < currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'SHORT') {
        direction = 'SHORT';
      }
    }
  }

  return {
    rsi: currentAdx, // Return ADX value instead of ATR for chart representation
    macdLine: upperBandCurrent,
    signalLine: lowerBandCurrent,
    direction,
  };
}

/**
 * Swing Support & Resistance Structure-Based Strategy
 * Uses EMA 9 & 21 crossover as trigger, but sets SL below swing support / above swing resistance.
 */
export function analyzeSwingStructure(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  tpPercent?: number;
  slPercent?: number;
} {
  const len = ohlcv.length;
  if (len < 205) {
    return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const closes = ohlcv.map((candle: any) => candle[4]);
  const highs = ohlcv.map((candle: any) => candle[2]);
  const lows = ohlcv.map((candle: any) => candle[3]);

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema200 = calculateEMA(closes, 200);
  const adx = calculateADX(highs, lows, closes, 14);

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const cEma9 = ema9[currentIdx];
  const cEma21 = ema21[currentIdx];
  const pEma9 = ema9[prevIdx];
  const pEma21 = ema21[prevIdx];
  const currentEma200 = ema200[currentIdx];
  const currentAdx = adx[currentIdx];

  if (
    isNaN(cEma9) ||
    isNaN(cEma21) ||
    isNaN(pEma9) ||
    isNaN(pEma21) ||
    isNaN(currentEma200) ||
    isNaN(currentAdx)
  ) {
    return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  // 1. Calculate 1-Hour Trend Alignment
  let trend1h: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 200) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema50_1h = calculateEMA(closes1h, 50);
    const ema200_1h = calculateEMA(closes1h, 200);
    const currentEma50_1h = ema50_1h[ema50_1h.length - 1];
    const currentEma200_1h = ema200_1h[ema200_1h.length - 1];
    if (!isNaN(currentEma50_1h) && !isNaN(currentEma200_1h)) {
      trend1h = currentEma50_1h > currentEma200_1h ? 'LONG' : 'SHORT';
    }
  }

  // 2. Calculate Volume Confirmation
  const volSma = calculateVolumeSMA(ohlcv, 20);
  const currentVolume = ohlcv[currentIdx][5];
  const currentVolSma = volSma[currentIdx];
  const isVolumeConfirmed = isNaN(currentVolSma) || (currentVolume >= 1.5 * currentVolSma);

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentAdx > 22 && isVolumeConfirmed) {
    if (pEma9 <= pEma21 && cEma9 > cEma21 && closes[currentIdx] > currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'LONG') {
        direction = 'LONG';
      }
    } else if (pEma9 >= pEma21 && cEma9 < cEma21 && closes[currentIdx] < currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'SHORT') {
        direction = 'SHORT';
      }
    }
  }

  if (direction === 'NEUTRAL') {
    return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  }

  const currentPrice = closes[currentIdx];
  let slPercent = 1.0;
  let tpPercent = 1.5;

  if (direction === 'LONG') {
    // Local swing low of last 20 candles
    const recentLows = lows.slice(-20);
    const supportPrice = Math.min(...recentLows);
    let slPrice = supportPrice * 0.999; // 0.1% buffer below support

    if (slPrice >= currentPrice) {
      slPrice = currentPrice * 0.99; // 1% fallback SL
    }

    slPercent = parseFloat((((currentPrice - slPrice) / currentPrice) * 100).toFixed(2));
    slPercent = Math.max(1.0, slPercent); // Min floor 1.0% SL
    
    // Recalculate SL Price based on floor
    slPrice = currentPrice * (1 - slPercent / 100);
    const risk = currentPrice - slPrice;
    
    // 1.5x Risk-to-Reward ratio
    const tpPrice = currentPrice + 1.5 * risk;
    tpPercent = parseFloat((((tpPrice - currentPrice) / currentPrice) * 100).toFixed(2));
    tpPercent = Math.max(1.5, tpPercent); // Min floor 1.5% TP

  } else if (direction === 'SHORT') {
    // Local swing high of last 20 candles
    const recentHighs = highs.slice(-20);
    const resistancePrice = Math.max(...recentHighs);
    let slPrice = resistancePrice * 1.001; // 0.1% buffer above resistance

    if (slPrice <= currentPrice) {
      slPrice = currentPrice * 1.01; // 1% fallback SL
    }

    slPercent = parseFloat((((slPrice - currentPrice) / currentPrice) * 100).toFixed(2));
    slPercent = Math.max(1.0, slPercent); // Min floor 1.0% SL

    // Recalculate SL Price based on floor
    slPrice = currentPrice * (1 + slPercent / 100);
    const risk = slPrice - currentPrice;

    // 1.5x Risk-to-Reward ratio
    const tpPrice = currentPrice - 1.5 * risk;
    tpPercent = parseFloat((((currentPrice - tpPrice) / currentPrice) * 100).toFixed(2));
    tpPercent = Math.max(1.5, tpPercent); // Min floor 1.5% TP
  }

  return {
    rsi: 50,
    macdLine: cEma9,
    signalLine: cEma21,
    direction,
    tpPercent,
    slPercent,
  };
}

/**
 * MACD Bullish/Bearish Divergence Reversal Strategy
 */
export function analyzeMacdDivergence(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 40) return { rsi: NaN, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
  
  const closes = ohlcv.map(c => c[4]);
  const macd = calculateMACD(closes);
  const hist = macd.histogram;

  const currentIdx = len - 1;
  const currentPrice = closes[currentIdx];
  const currentHist = hist[currentIdx];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (currentHist > 0) {
    let prevHighIdx = -1;
    for (let i = currentIdx - 4; i >= currentIdx - 20; i--) {
      if (closes[i] > closes[i-1] && closes[i] > closes[i+1]) {
        prevHighIdx = i;
        break;
      }
    }
    if (prevHighIdx !== -1 && currentPrice > closes[prevHighIdx] && currentHist < hist[prevHighIdx]) {
      direction = 'SHORT';
    }
  } else {
    let prevLowIdx = -1;
    for (let i = currentIdx - 4; i >= currentIdx - 20; i--) {
      if (closes[i] < closes[i-1] && closes[i] < closes[i+1]) {
        prevLowIdx = i;
        break;
      }
    }
    if (prevLowIdx !== -1 && currentPrice < closes[prevLowIdx] && currentHist > hist[prevLowIdx]) {
      direction = 'LONG';
    }
  }

  return {
    rsi: closes[currentIdx],
    macdLine: currentHist,
    signalLine: 0,
    direction
  };
}

/**
 * KDJ + Stochastic RSI Reversion Strategy
 */
export function analyzeKdjReversion(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 20) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  let k = 50;
  let d = 50;
  let j = 50;
  
  const kList: number[] = [];
  const dList: number[] = [];
  const jList: number[] = [];

  for (let i = 0; i < len; i++) {
    if (i < 8) {
      kList.push(50);
      dList.push(50);
      jList.push(50);
      continue;
    }
    const chunk = ohlcv.slice(i - 8, i + 1);
    const highs = chunk.map(c => c[2]);
    const lows = chunk.map(c => c[3]);
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    const close = ohlcv[i][4];
    
    const rsv = highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    j = 3 * k - 2 * d;

    kList.push(k);
    dList.push(d);
    jList.push(j);
  }

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const curJ = jList[currentIdx];
  const curK = kList[currentIdx];
  const curD = dList[currentIdx];
  const prevJ = jList[prevIdx];
  
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (prevJ <= curD && curJ > curD && curK < 25) {
    direction = 'LONG';
  } else if (prevJ >= curD && curJ < curD && curK > 75) {
    direction = 'SHORT';
  }

  return {
    rsi: curK,
    macdLine: curJ,
    signalLine: curD,
    direction
  };
}

/**
 * Fibonacci Pullback Reversion / Trend Continuation Strategy
 */
export function analyzeFibonacciPullback(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 50) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  let trend1h = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 200) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema200_1h = calculateEMA(closes1h, 200);
    const curEma200 = ema200_1h[ema200_1h.length - 1];
    const curClose1h = closes1h[closes1h.length - 1];
    trend1h = curClose1h > curEma200 ? 'LONG' : 'SHORT';
  }

  const closes = ohlcv.map(c => c[4]);
  const highest = Math.max(...closes.slice(-30));
  const lowest = Math.min(...closes.slice(-30));
  const range = highest - lowest;
  const currentPrice = closes[len - 1];
  const openPrice = ohlcv[len - 1][1];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (range > 0) {
    if (trend1h === 'LONG') {
      const fib50 = highest - 0.5 * range;
      const fib618 = highest - 0.618 * range;
      if (currentPrice >= fib618 && currentPrice <= fib50 && currentPrice > openPrice) {
        direction = 'LONG';
      }
    } else if (trend1h === 'SHORT') {
      const fib50 = lowest + 0.5 * range;
      const fib618 = lowest + 0.618 * range;
      if (currentPrice <= fib618 && currentPrice >= fib50 && currentPrice < openPrice) {
        direction = 'SHORT';
      }
    }
  }

  return {
    rsi: 50,
    macdLine: highest,
    signalLine: lowest,
    direction
  };
}

/**
 * Ichimoku Cloud Breakout Trend Following Strategy
 */
export function analyzeIchimokuCloudBreakout(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 100) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const calcPeriodValue = (pHighs: number[], pLows: number[], p: number, idx: number) => {
    const chunkHighs = pHighs.slice(idx - p + 1, idx + 1);
    const chunkLows = pLows.slice(idx - p + 1, idx + 1);
    return (Math.max(...chunkHighs) + Math.min(...chunkLows)) / 2;
  };

  const currentIdx = len - 1;
  const tenkan = calcPeriodValue(highs, lows, 9, currentIdx);
  const kijun = calcPeriodValue(highs, lows, 26, currentIdx);
  
  const tenkanPast = calcPeriodValue(highs, lows, 9, currentIdx - 26);
  const kijunPast = calcPeriodValue(highs, lows, 26, currentIdx - 26);
  const spanA = (tenkanPast + kijunPast) / 2;
  const spanB = calcPeriodValue(highs, lows, 52, currentIdx - 26);

  const currentClose = closes[currentIdx];
  const ema200 = calculateEMA(closes, 200)[currentIdx];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentClose > spanA && currentClose > spanB && tenkan > kijun && currentClose > ema200) {
    direction = 'LONG';
  } else if (currentClose < spanA && currentClose < spanB && tenkan < kijun && currentClose < ema200) {
    direction = 'SHORT';
  }

  return {
    rsi: tenkan,
    macdLine: spanA,
    signalLine: spanB,
    direction
  };
}

/**
 * VWAP Mean Reversion Strategy with Volatility Bands and Volume confirmation
 */
export function analyzeVwapReversion(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 30) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  let sumTypVol = 0;
  let sumVol = 0;
  
  const typicalPrices = ohlcv.map(c => (c[2] + c[3] + c[4]) / 3);
  const volumes = ohlcv.map(c => c[5]);

  for (let i = len - 20; i < len; i++) {
    sumTypVol += typicalPrices[i] * volumes[i];
    sumVol += volumes[i];
  }

  const vwap = sumVol === 0 ? typicalPrices[len - 1] : sumTypVol / sumVol;

  const avgPrice = typicalPrices.slice(-20).reduce((sum, p) => sum + p, 0) / 20;
  const variance = typicalPrices.slice(-20).reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / 20;
  const stdDev = Math.sqrt(variance);

  const upperBand = vwap + 2.2 * stdDev;
  const lowerBand = vwap - 2.2 * stdDev;

  const currentPrice = ohlcv[len - 1][4];
  const currentVolume = volumes[len - 1];
  
  const volSma = calculateVolumeSMA(ohlcv, 20)[len - 1];
  const isVolumeConfirmed = currentVolume > 1.8 * volSma;

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice <= lowerBand && isVolumeConfirmed) {
    direction = 'LONG';
  } else if (currentPrice >= upperBand && isVolumeConfirmed) {
    direction = 'SHORT';
  }

  return {
    rsi: 50,
    macdLine: vwap,
    signalLine: stdDev,
    direction
  };
}

/**
 * Optimized Bollinger Bands + RSI Reversion Strategy (Strict RSI limits)
 */
export function analyzeBollingerRsiOpt(prices: number[]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = prices.length;
  if (len < 30) return { rsi: NaN, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

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
  if (currentPrice <= currentLower && currentRsi <= 28) {
    direction = 'LONG';
  } else if (currentPrice >= currentUpper && currentRsi >= 72) {
    direction = 'SHORT';
  }

  return { rsi: currentRsi, macdLine: 0, signalLine: 0, direction };
}

/**
 * Optimized Double EMA Crossover (Strict ADX & 1.8x Volume Filter)
 */
export function analyzeDoubleEmaOpt(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 205) return { rsi: NaN, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);
  const volumes = ohlcv.map(c => c[5]);

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema200 = calculateEMA(closes, 200);
  const adx = calculateADX(highs, lows, closes, 14);

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const cEma9 = ema9[currentIdx];
  const cEma21 = ema21[currentIdx];
  const pEma9 = ema9[prevIdx];
  const pEma21 = ema21[prevIdx];
  const currentEma200 = ema200[currentIdx];
  const currentAdx = adx[currentIdx];

  const currentVolume = volumes[currentIdx];
  const volSma = calculateVolumeSMA(ohlcv, 20)[currentIdx];
  const isVolumeConfirmed = currentVolume > 1.8 * volSma;

  let trend1h = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 200) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema200_1h = calculateEMA(closes1h, 200);
    const curEma200 = ema200_1h[ema200_1h.length - 1];
    const curClose1h = closes1h[closes1h.length - 1];
    trend1h = curClose1h > curEma200 ? 'LONG' : 'SHORT';
  }

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentAdx > 26 && isVolumeConfirmed) {
    if (pEma9 <= pEma21 && cEma9 > cEma21 && closes[currentIdx] > currentEma200 && trend1h === 'LONG') {
      direction = 'LONG';
    } else if (pEma9 >= pEma21 && cEma9 < cEma21 && closes[currentIdx] < currentEma200 && trend1h === 'SHORT') {
      direction = 'SHORT';
    }
  }

  return { rsi: currentAdx, macdLine: cEma9, signalLine: cEma21, direction };
}

/**
 * Optimized SuperTrend + 200 EMA (Strict ADX & 1.8x Volume Filter)
 */
export function analyzeSuperTrendEmaOpt(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 205) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const ema200 = calculateEMA(closes, 200);
  const atr = calculateATR(highs, lows, closes, 10);
  const adx = calculateADX(highs, lows, closes, 14);

  const multiplier = 3;
  const trends: (string | null)[] = new Array(len).fill(null);
  const finalUpper: number[] = new Array(len).fill(NaN);
  const finalLower: number[] = new Array(len).fill(NaN);

  const startIdx = 10;
  finalUpper[startIdx] = (highs[startIdx] + lows[startIdx]) / 2 + multiplier * atr[startIdx];
  finalLower[startIdx] = (highs[startIdx] + lows[startIdx]) / 2 - multiplier * atr[startIdx];
  trends[startIdx] = 'LONG';

  for (let i = startIdx + 1; i < len; i++) {
    const basicUpper = (highs[i] + lows[i]) / 2 + multiplier * atr[i];
    const basicLower = (highs[i] + lows[i]) / 2 - multiplier * atr[i];

    if (basicUpper < finalUpper[i - 1] || closes[i - 1] > finalUpper[i - 1]) {
      finalUpper[i] = basicUpper;
    } else {
      finalUpper[i] = finalUpper[i - 1];
    }

    if (basicLower > finalLower[i - 1] || closes[i - 1] < finalLower[i - 1]) {
      finalLower[i] = basicLower;
    } else {
      finalLower[i] = finalLower[i - 1];
    }

    if (closes[i] > finalUpper[i]) {
      trends[i] = 'LONG';
    } else if (closes[i] < finalLower[i]) {
      trends[i] = 'SHORT';
    } else {
      trends[i] = trends[i - 1] || 'LONG';
    }
  }

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const currentTrend = trends[currentIdx];
  const prevTrend = trends[prevIdx];
  const currentClose = closes[currentIdx];
  const currentEma200 = ema200[currentIdx];
  const currentAdx = adx[currentIdx];

  let trend1h: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 200) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema50_1h = calculateEMA(closes1h, 50);
    const ema200_1h = calculateEMA(closes1h, 200);
    const currentEma50_1h = ema50_1h[ema50_1h.length - 1];
    const currentEma200_1h = ema200_1h[ema200_1h.length - 1];
    if (!isNaN(currentEma50_1h) && !isNaN(currentEma200_1h)) {
      trend1h = currentEma50_1h > currentEma200_1h ? 'LONG' : 'SHORT';
    }
  }

  const volSma = calculateVolumeSMA(ohlcv, 20);
  const currentVolume = ohlcv[currentIdx][5];
  const currentVolSma = volSma[currentIdx];
  const isVolumeConfirmed = !isNaN(currentVolSma) && (currentVolume >= 1.8 * currentVolSma);

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentAdx > 26 && isVolumeConfirmed) {
    if (prevTrend === 'SHORT' && currentTrend === 'LONG' && currentClose > currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'LONG') {
        direction = 'LONG';
      }
    } else if (prevTrend === 'LONG' && currentTrend === 'SHORT' && currentClose < currentEma200) {
      if (trend1h === 'NEUTRAL' || trend1h === 'SHORT') {
        direction = 'SHORT';
      }
    }
  }

  return { rsi: currentAdx, macdLine: 0, signalLine: 0, direction };
}

/**
 * Optimized KDJ + Stochastic RSI Reversion Strategy (Strict limits: K < 20 / K > 80)
 */
export function analyzeKdjReversionOpt(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 20) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  let k = 50;
  let d = 50;
  let j = 50;
  
  const kList: number[] = [];
  const dList: number[] = [];
  const jList: number[] = [];

  for (let i = 0; i < len; i++) {
    if (i < 8) {
      kList.push(50);
      dList.push(50);
      jList.push(50);
      continue;
    }
    const chunk = ohlcv.slice(i - 8, i + 1);
    const highs = chunk.map(c => c[2]);
    const lows = chunk.map(c => c[3]);
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    const close = ohlcv[i][4];
    
    const rsv = highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    j = 3 * k - 2 * d;

    kList.push(k);
    dList.push(d);
    jList.push(j);
  }

  const currentIdx = len - 1;
  const prevIdx = len - 2;

  const curJ = jList[currentIdx];
  const curK = kList[currentIdx];
  const curD = dList[currentIdx];
  const prevJ = jList[prevIdx];
  
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (prevJ <= curD && curJ > curD && curK < 20) {
    direction = 'LONG';
  } else if (prevJ >= curD && curJ < curD && curK > 80) {
    direction = 'SHORT';
  }

  return { rsi: curK, macdLine: curJ, signalLine: curD, direction };
}

/**
 * Optimized VWAP Reversion Strategy (Strict bands: 2.5 * stdDev)
 */
export function analyzeVwapReversionOpt(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 30) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  let sumTypVol = 0;
  let sumVol = 0;
  
  const typicalPrices = ohlcv.map(c => (c[2] + c[3] + c[4]) / 3);
  const volumes = ohlcv.map(c => c[5]);

  for (let i = len - 20; i < len; i++) {
    sumTypVol += typicalPrices[i] * volumes[i];
    sumVol += volumes[i];
  }

  const vwap = sumVol === 0 ? typicalPrices[len - 1] : sumTypVol / sumVol;

  const avgPrice = typicalPrices.slice(-20).reduce((sum, p) => sum + p, 0) / 20;
  const variance = typicalPrices.slice(-20).reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / 20;
  const stdDev = Math.sqrt(variance);

  const upperBand = vwap + 2.5 * stdDev;
  const lowerBand = vwap - 2.5 * stdDev;

  const currentPrice = ohlcv[len - 1][4];
  const currentVolume = volumes[len - 1];
  
  const volSma = calculateVolumeSMA(ohlcv, 20)[len - 1];
  const isVolumeConfirmed = currentVolume > 1.8 * volSma;

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice <= lowerBand && isVolumeConfirmed) {
    direction = 'LONG';
  } else if (currentPrice >= upperBand && isVolumeConfirmed) {
    direction = 'SHORT';
  }

  return { rsi: 50, macdLine: vwap, signalLine: stdDev, direction };
}

/**
 * Main Dispatcher Strategy analysis function.
 */
export function analyzeStrategy(
  ohlcv: number[][],
  strategy: string = 'RSI_MACD',
  ohlcv1h?: number[][],
  pair?: string
): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  tpPercent?: number;
  slPercent?: number;
} {
  const closePrices = ohlcv.map((candle: any) => candle[4]);

  if (strategy === 'COMBINATION_STRATEGIES') {
    if (!pair) {
      return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
    }
    const delegatedStrategy = COMBINATION_MAP[pair];
    if (!delegatedStrategy) {
      return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };
    }
    return analyzeStrategy(ohlcv, delegatedStrategy, ohlcv1h, pair);
  }

  let result: {
    rsi: number;
    macdLine: number;
    signalLine: number;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    tpPercent?: number;
    slPercent?: number;
  };

  if (strategy === 'BOLLINGER_RSI') {
    result = analyzeBollingerRsi(closePrices);
  } else if (strategy === 'BOLLINGER_RSI_OPT') {
    result = analyzeBollingerRsiOpt(closePrices);
  } else if (strategy === 'DOUBLE_EMA' || strategy === 'DOUBLE_EMA_5M' || strategy === 'DOUBLE_EMA_15M') {
    result = analyzeDoubleEma(ohlcv, ohlcv1h);
  } else if (strategy === 'DOUBLE_EMA_OPT') {
    result = analyzeDoubleEmaOpt(ohlcv, ohlcv1h);
  } else if (strategy === 'SUPERTREND_EMA') {
    result = analyzeSuperTrendEma(ohlcv, ohlcv1h);
  } else if (strategy === 'SUPERTREND_EMA_OPT') {
    result = analyzeSuperTrendEmaOpt(ohlcv, ohlcv1h);
  } else if (strategy === 'STOCH_RSI_MACD') {
    result = analyzeStochRsiMacd(ohlcv);
  } else if (strategy === 'ATR_BREAKOUT') {
    result = analyzeAtrBreakout(ohlcv, ohlcv1h);
  } else if (strategy === 'SWING_STRUCTURE') {
    result = analyzeSwingStructure(ohlcv, ohlcv1h);
  } else if (strategy === 'PREMIUM_80_WIN') {
    result = analyzePremium80Win(ohlcv, ohlcv1h);
  } else if (strategy === 'MACD_DIVERGENCE') {
    result = analyzeMacdDivergence(ohlcv);
  } else if (strategy === 'KDJ_REVERSION') {
    result = analyzeKdjReversion(ohlcv);
  } else if (strategy === 'KDJ_REVERSION_OPT') {
    result = analyzeKdjReversionOpt(ohlcv);
  } else if (strategy === 'FIBONACCI_PULLBACK') {
    result = analyzeFibonacciPullback(ohlcv, ohlcv1h);
  } else if (strategy === 'ICHIMOKU_CLOUDBREAK') {
    result = analyzeIchimokuCloudBreakout(ohlcv, ohlcv1h);
  } else if (strategy === 'VWAP_REVERSION') {
    result = analyzeVwapReversion(ohlcv);
  } else if (strategy === 'VWAP_REVERSION_OPT') {
    result = analyzeVwapReversionOpt(ohlcv);
  } else if (strategy === 'RSI_STOCH_EMA_TREND') {
    result = analyzeRsiStochEmaTrend(ohlcv);
  } else if (strategy === 'CMF_BREAKOUT') {
    result = analyzeCmfBreakout(ohlcv);
  } else if (strategy === 'HULL_MA_CROSSOVER') {
    result = analyzeHullMaCrossover(ohlcv);
  } else if (strategy === 'DONCHIAN_BREAKOUT') {
    result = analyzeDonchianBreakout(ohlcv);
  } else if (strategy === 'ADX_DI_MOMENTUM') {
    result = analyzeAdxDiMomentum(ohlcv);
  } else if (strategy === 'REGIME_ENSEMBLE_PRO') {
    result = analyzeRegimeEnsemblePro(ohlcv, ohlcv1h);
  } else {
    result = analyzeRsiMacd(closePrices);
  }

  // --- GLOBAL TREND FILTER (200 EMA) ---
  if (closePrices.length >= 200) {
    try {
      const ema200Arr = calculateEMA(closePrices, 200);
      if (ema200Arr && ema200Arr.length > 0) {
        const currentEma200 = ema200Arr[ema200Arr.length - 1];
        const currentPrice = closePrices[closePrices.length - 1];

        if (result.direction === 'LONG' && currentPrice < currentEma200) {
          console.log(`[Trend Filter] Blocking LONG signal for ${pair || 'unknown'} on strategy ${strategy} because price (${currentPrice.toFixed(4)}) is below EMA 200 (${currentEma200.toFixed(4)})`);
          result.direction = 'NEUTRAL';
        } else if (result.direction === 'SHORT' && currentPrice > currentEma200) {
          console.log(`[Trend Filter] Blocking SHORT signal for ${pair || 'unknown'} on strategy ${strategy} because price (${currentPrice.toFixed(4)}) is above EMA 200 (${currentEma200.toFixed(4)})`);
          result.direction = 'NEUTRAL';
        }
      }
    } catch (err: any) {
      console.error('Error applying EMA 200 Trend Filter:', err.message);
    }
  }

  return result;
}

/**
 * 1. RSI + Stochastic + EMA Trend Strategy
 */
export function analyzeRsiStochEmaTrend(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 200) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const currentIdx = len - 1;
  const currentClose = closes[currentIdx];

  const ema200 = calculateEMA(closes, 200)[currentIdx];
  const rsi = calculateRSI(closes, 14)[currentIdx];
  const { k, d } = calculateStochastic(highs, lows, closes, 14, 3, 3);
  const currentK = k[currentIdx];
  const currentD = d[currentIdx];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (currentClose > ema200 && rsi > 50 && currentK < 20 && currentK > currentD) {
    direction = 'LONG';
  } else if (currentClose < ema200 && rsi < 50 && currentK > 80 && currentK < currentD) {
    direction = 'SHORT';
  }

  return { rsi: rsi || 50, macdLine: currentK || 0, signalLine: currentD || 0, direction };
}

/**
 * 2. Chaikin Money Flow + Bollinger Bands Breakout Strategy
 */
export function analyzeCmfBreakout(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 30) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);
  const volumes = ohlcv.map(c => c[5]);

  const currentIdx = len - 1;
  const currentClose = closes[currentIdx];

  const cmf = calculateCMF(highs, lows, closes, volumes, 20)[currentIdx];
  const { upper, lower } = calculateBollingerBands(closes, 20, 2);
  const currentUpper = upper[currentIdx];
  const currentLower = lower[currentIdx];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (cmf > 0.15 && currentClose > currentUpper) {
    direction = 'LONG';
  } else if (cmf < -0.15 && currentClose < currentLower) {
    direction = 'SHORT';
  }

  return { rsi: cmf * 100, macdLine: currentUpper, signalLine: currentLower, direction };
}

/**
 * 3. Hull Moving Average Trend Following Strategy
 */
export function analyzeHullMaCrossover(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 100) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const closes = ohlcv.map(c => c[4]);
  const currentIdx = len - 1;
  const currentClose = closes[currentIdx];

  const ema100 = calculateEMA(closes, 100)[currentIdx];
  const hma9 = calculateHMA(closes, 9);
  const hma21 = calculateHMA(closes, 21);

  const currentHma9 = hma9[currentIdx];
  const currentHma21 = hma21[currentIdx];
  const prevHma9 = hma9[currentIdx - 1];
  const prevHma21 = hma21[currentIdx - 1];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (currentClose > ema100 && currentHma9 > currentHma21 && prevHma9 <= prevHma21) {
    direction = 'LONG';
  } else if (currentClose < ema100 && currentHma9 < currentHma21 && prevHma9 >= prevHma21) {
    direction = 'SHORT';
  }

  return { rsi: 50, macdLine: currentHma9 || 0, signalLine: currentHma21 || 0, direction };
}

/**
 * 4. Donchian Channel Breakout Strategy
 */
export function analyzeDonchianBreakout(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 50) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const currentIdx = len - 1;
  const currentClose = closes[currentIdx];

  const adx = calculateADX(highs, lows, closes, 14)[currentIdx];
  const { upper, lower } = calculateDonchian(highs, lows, 20);
  const currentUpper = upper[currentIdx - 1]; // Use previous bar's channel boundary to evaluate breakout
  const currentLower = lower[currentIdx - 1];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (adx > 25 && currentClose > currentUpper) {
    direction = 'LONG';
  } else if (adx > 25 && currentClose < currentLower) {
    direction = 'SHORT';
  }

  return { rsi: adx, macdLine: currentUpper, signalLine: currentLower, direction };
}

/**
 * 5. Directional Movement Index (DMI/ADX) Momentum Strategy
 */
export function analyzeAdxDiMomentum(ohlcv: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 50) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);

  const currentIdx = len - 1;
  const { adx, plusDI, minusDI } = calculateDMI(highs, lows, closes, 14);

  const currentAdx = adx[currentIdx];
  const currentPlus = plusDI[currentIdx];
  const currentMinus = minusDI[currentIdx];
  const prevPlus = plusDI[currentIdx - 1];
  const prevMinus = minusDI[currentIdx - 1];

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  if (currentAdx > 28 && currentPlus > currentMinus && prevPlus <= prevMinus) {
    direction = 'LONG';
  } else if (currentAdx > 28 && currentMinus > currentPlus && prevMinus <= prevPlus) {
    direction = 'SHORT';
  }

  return { rsi: currentAdx || 0, macdLine: currentPlus || 0, signalLine: currentMinus || 0, direction };
}

/**
 * Calculation Helpers
 */
export function calculateDMI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = closes.length;
  const adx: number[] = new Array(len).fill(NaN);
  const plusDI: number[] = new Array(len).fill(NaN);
  const minusDI: number[] = new Array(len).fill(NaN);
  if (len < 2 * period) return { adx, plusDI, minusDI };

  const tr: number[] = [highs[0] - lows[0]];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < len; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const smoothedTR: number[] = new Array(len).fill(NaN);
  const smoothedPlusDM: number[] = new Array(len).fill(NaN);
  const smoothedMinusDM: number[] = new Array(len).fill(NaN);

  let sumTR = 0, sumPlus = 0, sumMinus = 0;
  for (let i = 0; i < period; i++) {
    sumTR += tr[i];
    sumPlus += plusDM[i];
    sumMinus += minusDM[i];
  }
  smoothedTR[period - 1] = sumTR;
  smoothedPlusDM[period - 1] = sumPlus;
  smoothedMinusDM[period - 1] = sumMinus;

  for (let i = period; i < len; i++) {
    smoothedTR[i] = smoothedTR[i - 1] - (smoothedTR[i - 1] / period) + tr[i];
    smoothedPlusDM[i] = smoothedPlusDM[i - 1] - (smoothedPlusDM[i - 1] / period) + plusDM[i];
    smoothedMinusDM[i] = smoothedMinusDM[i - 1] - (smoothedMinusDM[i - 1] / period) + minusDM[i];
  }

  const dx: number[] = new Array(len).fill(NaN);
  for (let i = period - 1; i < len; i++) {
    const trVal = smoothedTR[i];
    if (trVal === 0) {
      plusDI[i] = 0;
      minusDI[i] = 0;
      dx[i] = 0;
      continue;
    }
    plusDI[i] = 100 * (smoothedPlusDM[i] / trVal);
    minusDI[i] = 100 * (smoothedMinusDM[i] / trVal);
    const sumDI = plusDI[i] + minusDI[i];
    const diffDI = Math.abs(plusDI[i] - minusDI[i]);
    dx[i] = sumDI === 0 ? 0 : (diffDI / sumDI) * 100;
  }

  let sumDX = 0;
  for (let i = period - 1; i < 2 * period - 1; i++) {
    sumDX += dx[i];
  }
  adx[2 * period - 2] = sumDX / period;

  for (let i = 2 * period - 1; i < len; i++) {
    adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
  }

  return { adx, plusDI, minusDI };
}

export function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): { k: number[]; d: number[] } {
  const len = closes.length;
  const kList: number[] = new Array(len).fill(NaN);
  const dList: number[] = new Array(len).fill(NaN);
  if (len < period) return { k: kList, d: dList };

  const rawK: number[] = new Array(len).fill(NaN);
  for (let i = period - 1; i < len; i++) {
    const sliceHighs = highs.slice(i - period + 1, i + 1);
    const sliceLows = lows.slice(i - period + 1, i + 1);
    const maxHigh = Math.max(...sliceHighs);
    const minLow = Math.min(...sliceLows);
    const range = maxHigh - minLow;
    rawK[i] = range === 0 ? 50 : ((closes[i] - minLow) / range) * 100;
  }

  for (let i = period + smoothK - 2; i < len; i++) {
    const slice = rawK.slice(i - smoothK + 1, i + 1);
    kList[i] = slice.reduce((sum, v) => sum + v, 0) / smoothK;
  }

  for (let i = period + smoothK + smoothD - 3; i < len; i++) {
    const slice = kList.slice(i - smoothD + 1, i + 1);
    dList[i] = slice.reduce((sum, v) => sum + v, 0) / smoothD;
  }

  return { k: kList, d: dList };
}

export function calculateCMF(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 20
): number[] {
  const len = closes.length;
  const cmf: number[] = new Array(len).fill(NaN);
  if (len < period) return cmf;

  const mfv: number[] = [];
  for (let i = 0; i < len; i++) {
    const range = highs[i] - lows[i];
    const mfm = range === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    mfv.push(mfm * volumes[i]);
  }

  for (let i = period - 1; i < len; i++) {
    const sumMfv = mfv.slice(i - period + 1, i + 1).reduce((sum, v) => sum + v, 0);
    const sumVol = volumes.slice(i - period + 1, i + 1).reduce((sum, v) => sum + v, 0);
    cmf[i] = sumVol === 0 ? 0 : sumMfv / sumVol;
  }

  return cmf;
}

export function calculateWMA(prices: number[], period: number): number[] {
  const len = prices.length;
  const wma: number[] = new Array(len).fill(NaN);
  if (len < period) return wma;

  let denominator = (period * (period + 1)) / 2;

  for (let i = period - 1; i < len; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - period + 1 + j] * (j + 1);
    }
    wma[i] = sum / denominator;
  }

  return wma;
}

export function calculateHMA(prices: number[], period: number): number[] {
  const len = prices.length;
  const hma: number[] = new Array(len).fill(NaN);
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  if (len < period) return hma;

  const wmaHalf = calculateWMA(prices, halfPeriod);
  const wmaFull = calculateWMA(prices, period);

  const rawHma: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (isNaN(wmaHalf[i]) || isNaN(wmaFull[i])) continue;
    rawHma[i] = 2 * wmaHalf[i] - wmaFull[i];
  }

  const cleanRawHma: number[] = [];
  const rawHmaIndexes: number[] = [];
  for (let i = 0; i < len; i++) {
    if (!isNaN(rawHma[i])) {
      cleanRawHma.push(rawHma[i]);
      rawHmaIndexes.push(i);
    }
  }

  const wmaRaw = calculateWMA(cleanRawHma, sqrtPeriod);
  for (let i = 0; i < wmaRaw.length; i++) {
    if (!isNaN(wmaRaw[i])) {
      const origIndex = rawHmaIndexes[i];
      hma[origIndex] = wmaRaw[i];
    }
  }

  return hma;
}

export function calculateDonchian(
  highs: number[],
  lows: number[],
  period: number = 20
): { upper: number[]; lower: number[]; middle: number[] } {
  const len = highs.length;
  const upper: number[] = new Array(len).fill(NaN);
  const lower: number[] = new Array(len).fill(NaN);
  const middle: number[] = new Array(len).fill(NaN);
  if (len < period) return { upper, lower, middle };

  for (let i = period - 1; i < len; i++) {
    const sliceHighs = highs.slice(i - period + 1, i + 1);
    const sliceLows = lows.slice(i - period + 1, i + 1);
    upper[i] = Math.max(...sliceHighs);
    lower[i] = Math.min(...sliceLows);
    middle[i] = (upper[i] + lower[i]) / 2;
  }

  return { upper, lower, middle };
}

/**
 * 6. REGIME_ENSEMBLE_PRO (Regime-Aware Ensemble Consensus Strategy)
 */
export function analyzeRegimeEnsemblePro(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
} {
  const len = ohlcv.length;
  if (len < 50) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  // 1. Determine Market Regime using 1-Hour Timeframe (or fallback to execution timeframe)
  const regimeSource = (ohlcv1h && ohlcv1h.length >= 100) ? ohlcv1h : ohlcv;
  const rCloses = regimeSource.map(c => c[4]);
  const rHighs = regimeSource.map(c => c[2]);
  const rLows = regimeSource.map(c => c[3]);
  const rLen = regimeSource.length;

  const currentPrice = rCloses[rLen - 1];
  const ema200 = calculateEMA(rCloses, 100)[rLen - 1]; // Responsive medium-term trend line
  const adx = calculateADX(rHighs, rLows, rCloses, 14)[rLen - 1];

  let regime: 'TRENDING_BULLISH' | 'TRENDING_BEARISH' | 'SIDEWAYS_CHOP' = 'SIDEWAYS_CHOP';

  if (!isNaN(adx)) {
    if (adx > 22) {
      if (currentPrice > ema200) {
        regime = 'TRENDING_BULLISH';
      } else {
        regime = 'TRENDING_BEARISH';
      }
    }
  }

  // 2. Define Pool of Active Strategies based on Regime
  let activeStrategies: string[] = [];
  if (regime === 'TRENDING_BULLISH') {
    activeStrategies = [
      'ICHIMOKU_CLOUDBREAK',
      'FIBONACCI_PULLBACK',
      'SUPERTREND_EMA_OPT',
      'DOUBLE_EMA_OPT',
      'DONCHIAN_BREAKOUT'
    ];
  } else if (regime === 'TRENDING_BEARISH') {
    activeStrategies = [
      'ICHIMOKU_CLOUDBREAK',
      'SUPERTREND_EMA_OPT',
      'DOUBLE_EMA_OPT',
      'DONCHIAN_BREAKOUT'
    ];
  } else {
    // SIDEWAYS_CHOP
    activeStrategies = [
      'BOLLINGER_RSI_OPT',
      'VWAP_REVERSION_OPT',
      'KDJ_REVERSION_OPT'
    ];
  }

  // 3. Collect Signals / Votes
  let longVotes = 0;
  let shortVotes = 0;
  const totalActive = activeStrategies.length;

  activeStrategies.forEach(strat => {
    const analysis = analyzeStrategy(ohlcv, strat, ohlcv1h);
    if (analysis.direction === 'LONG') {
      longVotes++;
    } else if (analysis.direction === 'SHORT') {
      shortVotes++;
    }
  });

  // 4. Calculate Consensus
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  const threshold = regime === 'SIDEWAYS_CHOP' ? 0.66 : 0.60;

  if (longVotes / totalActive >= threshold) {
    if (regime !== 'TRENDING_BEARISH') {
      direction = 'LONG';
    }
  } else if (shortVotes / totalActive >= threshold) {
    if (regime !== 'TRENDING_BULLISH') {
      direction = 'SHORT';
    }
  }

  const regimeNum = regime === 'TRENDING_BULLISH' ? 1 : regime === 'TRENDING_BEARISH' ? -1 : 0;

  return {
    rsi: adx || 0,
    macdLine: regimeNum,
    signalLine: totalActive,
    direction
  };
}

/**
 * Ultra-High Probability Premium Strategy (Targeting 75-80% Win Rate via strict filters)
 */
export function analyzePremium80Win(ohlcv: number[][], ohlcv1h?: number[][]): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  tpPercent?: number;
  slPercent?: number;
} {
  const len = ohlcv.length;
  if (len < 200) return { rsi: 50, macdLine: 0, signalLine: 0, direction: 'NEUTRAL' };

  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const closes = ohlcv.map(c => c[4]);
  const currentPrice = closes[len - 1];

  // 1. Calculate 15m Indicators
  const rsiVals = calculateRSI(closes, 14);
  const currentRsi = rsiVals[rsiVals.length - 1] || 50;

  // Stochastic
  const stochRsiVals = calculateStochastic(highs, lows, closes, 14, 3, 3);
  const k = stochRsiVals.k[stochRsiVals.k.length - 1] || 50;
  const d = stochRsiVals.d[stochRsiVals.d.length - 1] || 50;
  const prevK = stochRsiVals.k[stochRsiVals.k.length - 2] || 50;
  const prevD = stochRsiVals.d[stochRsiVals.d.length - 2] || 50;

  // 15m EMA 200
  const ema200Arr = calculateEMA(closes, 200);
  const ema200_15m = ema200Arr[ema200Arr.length - 1];

  // 2. Multi-Timeframe Trend Check (1-Hour candles)
  let trend1h: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (ohlcv1h && ohlcv1h.length >= 100) {
    const closes1h = ohlcv1h.map(c => c[4]);
    const ema50_1hArr = calculateEMA(closes1h, 50);
    const ema200_1hArr = calculateEMA(closes1h, 100);
    const ema50_1h = ema50_1hArr[ema50_1hArr.length - 1];
    const ema200_1h = ema200_1hArr[ema200_1hArr.length - 1];
    
    if (closes1h[closes1h.length - 1] > ema200_1h && ema50_1h > ema200_1h) {
      trend1h = 'UP';
    } else if (closes1h[closes1h.length - 1] < ema200_1h && ema50_1h < ema200_1h) {
      trend1h = 'DOWN';
    }
  } else {
    trend1h = currentPrice > ema200_15m ? 'UP' : 'DOWN';
  }

  // 3. Execution Signal Trigger Rules
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  // LONG Trigger: Upward Trend + Deep RSI Oversold (< 30) + Stoch Golden Cross in oversold territory
  if (trend1h === 'UP' && currentRsi < 30 && prevK <= prevD && k > d && k < 30) {
    direction = 'LONG';
  }
  // SHORT Trigger: Downward Trend + Deep RSI Overbought (> 70) + Stoch Dead Cross in overbought territory
  else if (trend1h === 'DOWN' && currentRsi > 70 && prevK >= prevD && k < d && k > 70) {
    direction = 'SHORT';
  }

  return {
    rsi: currentRsi,
    macdLine: 0,
    signalLine: 0,
    direction,
    tpPercent: 1.0,
    slPercent: 1.5,
  };
}
