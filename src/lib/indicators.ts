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
 * Main Dispatcher Strategy analysis function.
 */
export function analyzeStrategy(
  ohlcv: number[][],
  strategy: string = 'RSI_MACD',
  ohlcv1h?: number[][]
): {
  rsi: number;
  macdLine: number;
  signalLine: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  tpPercent?: number;
  slPercent?: number;
} {
  const closePrices = ohlcv.map((candle: any) => candle[4]);

  if (strategy === 'BOLLINGER_RSI') {
    return analyzeBollingerRsi(closePrices);
  } else if (strategy === 'DOUBLE_EMA') {
    return analyzeDoubleEma(ohlcv, ohlcv1h);
  } else if (strategy === 'SUPERTREND_EMA') {
    return analyzeSuperTrendEma(ohlcv, ohlcv1h);
  } else if (strategy === 'STOCH_RSI_MACD') {
    return analyzeStochRsiMacd(ohlcv);
  } else if (strategy === 'ATR_BREAKOUT') {
    return analyzeAtrBreakout(ohlcv, ohlcv1h);
  } else if (strategy === 'SWING_STRUCTURE') {
    return analyzeSwingStructure(ohlcv, ohlcv1h);
  } else {
    return analyzeRsiMacd(closePrices);
  }
}
