import { supabase } from './supabase';
import { calculateEMA, calculateADX, calculateStochastic, calculateRSI, calculateATR } from './indicators';

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  epoch: number;
}

// 1. GMT Session Filter Check (Asian low-volatility session 21:00 to 23:59 GMT)
export function isAsianSessionBlocked(): boolean {
  const gmtHour = new Date().getUTCHours();
  // Block between 21:00 and 23:59 GMT
  return gmtHour >= 21 && gmtHour <= 23;
}

// 2. Spread Filter Check (pip sizing: 0.0001 for EUR/USD, GBP/USD, 0.01 for USD/JPY)
export function isSpreadBlocked(symbol: string, ask: number, bid: number): boolean {
  const spread = Math.abs(ask - bid);
  let pips = 0;

  if (symbol.includes('JPY') || symbol === 'USDJPY') {
    pips = spread / 0.01;
  } else {
    pips = spread / 0.0001;
  }

  return pips > 2.0;
}

let cachedXmlText: string | null = null;
let cachedXmlTime = 0;

export async function isEconomicNewsBlocked(symbol: string): Promise<boolean> {
  try {
    const nowMs = Date.now();
    let xmlText = '';

    if (cachedXmlText && (nowMs - cachedXmlTime < 600000)) {
      xmlText = cachedXmlText;
    } else {
      const res = await fetch('https://nfs.forexfactory.com/ff_calendar_thisweek.xml', {
        signal: AbortSignal.timeout(4000) // 4 second safety timeout
      });

      if (res.status !== 200) {
        if (cachedXmlText) {
          xmlText = cachedXmlText; // Fallback to cache on network issue
        } else {
          return false; // Skip block if fetch fails and no cache
        }
      } else {
        xmlText = await res.text();
        cachedXmlText = xmlText;
        cachedXmlTime = nowMs;
      }
    }
    
    // Simple regex parser for XML entries
    const eventRegex = /<event>([\s\S]*?)<\/event>/g;
    const targetCurrencies = ['USD', 'EUR', 'GBP'];
    let match: RegExpExecArray | null;

    while ((match = eventRegex.exec(xmlText)) !== null) {
      const entry = match[1];
      
      const titleMatch = entry.match(/<title>(.*?)<\/title>/);
      const countryMatch = entry.match(/<country>(.*?)<\/country>/);
      const dateMatch = entry.match(/<date>(.*?)<\/date>/);
      const timeMatch = entry.match(/<time>(.*?)<\/time>/);
      const impactMatch = entry.match(/<impact>(.*?)<\/impact>/);

      const title = titleMatch ? titleMatch[1] : '';
      const country = countryMatch ? countryMatch[1] : '';
      const dateStr = dateMatch ? dateMatch[1] : '';
      const timeStr = timeMatch ? timeMatch[1] : '';
      const impact = impactMatch ? impactMatch[1] : '';

      // We only care about High Impact news for EUR, USD, GBP
      if (impact.toLowerCase() === 'high' && targetCurrencies.includes(country.toUpperCase())) {
        // Parse date and time (ForexFactory XML uses EST/EDT by default)
        // Format: <date>08-28-2026</date> <time>8:30am</time>
        try {
          const dateParts = dateStr.split('-');
          if (dateParts.length === 3) {
            const timeClean = timeStr.replace(/(am|pm)/i, ' $1');
            const datetimeStr = `${dateParts[2]}-${dateParts[0]}-${dateParts[1]} ${timeClean} EST`;
            const newsTimeMs = Date.parse(datetimeStr);

            if (!isNaN(newsTimeMs)) {
              const diffMinutes = Math.abs(nowMs - newsTimeMs) / (60 * 1000);
              // Block if current time is within 30 minutes of news release
              if (diffMinutes <= 30) {
                console.log(`⚠️ Economic News Block Active: High Impact event "${title}" on ${country} at ${datetimeStr}`);
                return true;
              }
            }
          }
        } catch (parseErr) {
          // Ignore parse errors on single xml node
        }
      }
    }
  } catch (e: any) {
    console.warn('Failed to parse economic news, bypassing block filter:', e.message);
  }
  return false;
}

// 4. Consecutive Loss Cooldown & Daily Limit Checks
export async function getRiskControlsStatus(): Promise<{
  isCooldownBlocked: boolean;
  isDailyLimitBlocked: boolean;
  dailyTradesCount: number;
}> {
  let isCooldownBlocked = false;
  let isDailyLimitBlocked = false;
  let dailyTradesCount = 0;

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Fetch trades count created today
    const { count, error: countErr } = await supabase
      .from('deriv_trades')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', todayStart.toISOString());

    if (!countErr && count !== null) {
      dailyTradesCount = count;
      if (dailyTradesCount >= 10) {
        isDailyLimitBlocked = true;
      }
    }

    // Fetch last 2 completed trades to check consecutive losses
    const { data: lastTrades, error: tradesErr } = await supabase
      .from('deriv_trades')
      .select('status, closed_at')
      .neq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(2);

    if (!tradesErr && lastTrades && lastTrades.length === 2) {
      const allLost = lastTrades.every(t => t.status === 'LOST');
      if (allLost) {
        // Check if the most recent loss happened within the last 60 minutes
        const lastClosedAt = new Date(lastTrades[0].closed_at).getTime();
        const diffMinutes = (Date.now() - lastClosedAt) / (60 * 1000);
        if (diffMinutes <= 60) {
          isCooldownBlocked = true;
        }
      }
    }
  } catch (err: any) {
    console.error('Error fetching risk controls status from DB:', err.message);
  }

  return { isCooldownBlocked, isDailyLimitBlocked, dailyTradesCount };
}

// 5. Core Multi-Timeframe Strategy Logic (H1 EMA 200 + 15m EMA 50 + 15m ADX + 5m Stochastic)
export function analyzeForex15mStrategy(
  candles5m: Candle[],
  candles15m: Candle[],
  candlesH1: Candle[]
): { 
  direction: 'CALL' | 'PUT' | 'NEUTRAL'; 
  adxValue: number;
  nearEntry: {
    isNear: boolean;
    direction: 'RISE' | 'FALL' | 'NEUTRAL';
    reason: string;
    stochK: number;
    stochD: number;
    confirmations: {
      trend: boolean;
      adx: boolean;
      stochZone: boolean;
    }
  }
} {
  
  if (candles5m.length < 30 || candles15m.length < 40 || candlesH1.length < 210) {
    return { 
      direction: 'NEUTRAL', 
      adxValue: 0, 
      nearEntry: { 
        isNear: false, 
        direction: 'NEUTRAL', 
        reason: 'Insufficient data', 
        stochK: 0, 
        stochD: 0,
        confirmations: { trend: false, adx: false, stochZone: false }
      } 
    };
  }

  // A. H1 Trend (EMA 200)
  const h1Closes = candlesH1.map(c => c.close);
  const h1Ema200 = calculateEMA(h1Closes, 200);
  const currentH1Ema200 = h1Ema200[h1Ema200.length - 1];
  const currentH1Price = h1Closes[h1Closes.length - 1];
  const isH1Uptrend = currentH1Price > currentH1Ema200;
  const isH1Downtrend = currentH1Price < currentH1Ema200;

  // B. 15m Trend & Strength (EMA 50 & ADX 14)
  const closes15m = candles15m.map(c => c.close);
  const highs15m = candles15m.map(c => c.high);
  const lows15m = candles15m.map(c => c.low);

  const ema50_15m = calculateEMA(closes15m, 50);
  const current15mEma50 = ema50_15m[ema50_15m.length - 1];
  const current15mPrice = closes15m[closes15m.length - 1];

  const adx14_15m = calculateADX(highs15m, lows15m, closes15m, 14);
  const current15mADX = adx14_15m[adx14_15m.length - 1] || 0;

  const is15mUptrend = current15mPrice > current15mEma50;
  const is15mDowntrend = current15mPrice < current15mEma50;
  const isADXStrong = current15mADX > 22;

  // C. 5m Trigger (Stochastic 14, 3, 3)
  const closes5m = candles5m.map(c => c.close);
  const highs5m = candles5m.map(c => c.high);
  const lows5m = candles5m.map(c => c.low);

  const stoch = calculateStochastic(highs5m, lows5m, closes5m, 14, 3, 3);
  const kLine = stoch.k;
  const dLine = stoch.d;

  const currentK = kLine[kLine.length - 1] || 0;
  const currentD = dLine[dLine.length - 1] || 0;
  const prevK = kLine[kLine.length - 2] || 0;
  const prevD = dLine[dLine.length - 2] || 0;

  // Stochastic Crossovers triggers
  // CALL Trigger: %K crosses above 30 from below, OR %K crosses %D from below 30
  const isStochCallCrossover = 
    (prevK < 30 && currentK >= 30) || 
    (prevK <= prevD && currentK > currentD && currentK < 30);

  // PUT Trigger: %K crosses below 70 from above, OR %K crosses %D from above 70
  const isStochPutCrossover = 
    (prevK > 70 && currentK <= 70) || 
    (prevK >= prevD && currentK < currentD && currentK > 70);

  // Execution Signal Trigger Rules
  let direction: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';

  // Candle Momentum Confirmation Rule (Require bullish/bearish candle color)
  const currentCandle5m = candles5m[candles5m.length - 1];
  const lastClosedCandle5m = candles5m[candles5m.length - 2] || currentCandle5m;
  const isCallCandleConfirmed = lastClosedCandle5m.close > lastClosedCandle5m.open && currentCandle5m.close >= currentCandle5m.open;
  const isPutCandleConfirmed = lastClosedCandle5m.close < lastClosedCandle5m.open && currentCandle5m.close <= currentCandle5m.open;

  if (isH1Uptrend && is15mUptrend && isADXStrong && isStochCallCrossover && isCallCandleConfirmed) {
    direction = 'CALL';
  } else if (isH1Downtrend && is15mDowntrend && isADXStrong && isStochPutCrossover && isPutCandleConfirmed) {
    direction = 'PUT';
  }

  // D. Check if pair is near entry (Watchlist diagnostics)
  let isNear = false;
  let reason = '';
  if (isH1Uptrend && is15mUptrend && current15mADX > 15) {
    if (currentK < 45 && !isStochCallCrossover) {
      isNear = true;
      reason = `Uptrend (ADX ${current15mADX.toFixed(1)}) - Waiting for Stochastic gold cross (K: ${currentK.toFixed(0)}, D: ${currentD.toFixed(0)})`;
    }
  } else if (isH1Downtrend && is15mDowntrend && current15mADX > 15) {
    if (currentK > 55 && !isStochPutCrossover) {
      isNear = true;
      reason = `Downtrend (ADX ${current15mADX.toFixed(1)}) - Waiting for Stochastic death cross (K: ${currentK.toFixed(0)}, D: ${currentD.toFixed(0)})`;
    }
  }

  return { 
    direction, 
    adxValue: current15mADX,
    nearEntry: {
      isNear,
      direction: isH1Uptrend ? 'RISE' : isH1Downtrend ? 'FALL' : 'NEUTRAL',
      reason,
      stochK: currentK,
      stochD: currentD,
      confirmations: {
        trend: (isH1Uptrend && is15mUptrend) || (isH1Downtrend && is15mDowntrend),
        adx: isADXStrong,
        stochZone: isH1Uptrend ? (currentK < 30) : (currentK > 70)
      }
    }
  };
}

export function getPivotSR(candles: Candle[]): { supports: number[], resistances: number[] } {
  const supports: number[] = [];
  const resistances: number[] = [];
  const n = 3; // pivot window range

  for (let i = n; i < candles.length - n; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= n; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isHigh = false;
      }
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isLow = false;
      }
    }
    if (isHigh) resistances.push(candles[i].high);
    if (isLow) supports.push(candles[i].low);
  }
  return { supports, resistances };
}

export function analyzeForex15mStrategyV2(
  candles5m: Candle[],
  candles15m: Candle[],
  candlesH1: Candle[]
): {
  direction: 'CALL' | 'PUT' | 'NEUTRAL'; 
  adxValue: number;
  nearEntry: {
    isNear: boolean;
    direction: 'RISE' | 'FALL' | 'NEUTRAL';
    reason: string;
    stochK: number;
    stochD: number;
    confirmations: {
      trend: boolean;
      adx: boolean;
      stochZone: boolean;
      srSafe: boolean;
      candleSafe: boolean;
    }
  }
} {
  const base = analyzeForex15mStrategy(candles5m, candles15m, candlesH1);
  if (base.direction === 'NEUTRAL') {
    return {
      direction: 'NEUTRAL',
      adxValue: base.adxValue,
      nearEntry: {
        ...base.nearEntry,
        confirmations: {
          ...base.nearEntry.confirmations,
          srSafe: true,
          candleSafe: true
        }
      }
    };
  }

  const currentCandle = candles5m[candles5m.length - 1];
  const currentPrice = currentCandle.close;
  const lastCandle = candles5m[candles5m.length - 2] || currentCandle;

  // 1. Support & Resistance Filter
  const { supports, resistances } = getPivotSR(candles5m);
  let srSafe = true;
  let blockReason = '';
  const thresholdPercent = 0.001; // 0.1% near S/R level

  if (base.direction === 'CALL') {
    for (const r of resistances) {
      if (currentPrice < r && (r - currentPrice) / currentPrice <= thresholdPercent) {
        srSafe = false;
        blockReason = `Resistance zone detected at $${r.toFixed(2)}. Blocking CALL.`;
        break;
      }
    }
  } else if (base.direction === 'PUT') {
    for (const s of supports) {
      if (currentPrice > s && (currentPrice - s) / currentPrice <= thresholdPercent) {
        srSafe = false;
        blockReason = `Support zone detected at $${s.toFixed(2)}. Blocking PUT.`;
        break;
      }
    }
  }

  // 2. Candlestick Confirmation Filter (Both trigger candle and live candle must confirm momentum)
  let candleSafe = true;
  if (base.direction === 'CALL') {
    if (lastCandle.close <= lastCandle.open || currentCandle.close < currentCandle.open) {
      candleSafe = false;
      blockReason = 'Candle confirmation failed (not bullish). Blocking CALL.';
    }
  } else if (base.direction === 'PUT') {
    if (lastCandle.close >= lastCandle.open || currentCandle.close > currentCandle.open) {
      candleSafe = false;
      blockReason = 'Candle confirmation failed (not bearish). Blocking PUT.';
    }
  }

  let finalDirection: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
  if (srSafe && candleSafe) {
    finalDirection = base.direction;
  }

  return {
    direction: finalDirection,
    adxValue: base.adxValue,
    nearEntry: {
      ...base.nearEntry,
      reason: finalDirection === 'NEUTRAL' && blockReason ? `[V2 Blocked] ${blockReason}` : base.nearEntry.reason,
      confirmations: {
        ...base.nearEntry.confirmations,
        srSafe,
        candleSafe
      }
    }
  };
}

function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

export function analyzeForex30mStrategyV3(
  candles10m: Candle[],
  candles30m: Candle[],
  candlesH1: Candle[],
  candlesH4: Candle[]
): {
  direction: 'CALL' | 'PUT' | 'NEUTRAL'; 
  adxValue: number;
  nearEntry: {
    isNear: boolean;
    direction: 'RISE' | 'FALL' | 'NEUTRAL';
    reason: string;
    stochK: number;
    stochD: number;
    confirmations: {
      trend: boolean;
      adx: boolean;
      stochZone: boolean;
      srSafe: boolean;
      candleSafe: boolean;
      rsiSafe: boolean;
      volatilitySafe: boolean;
    }
  }
} {
  // 1. Data sanity checks
  if (candles10m.length < 30 || candles30m.length < 40 || candlesH1.length < 110 || candlesH4.length < 210) {
    return {
      direction: 'NEUTRAL',
      adxValue: 0,
      nearEntry: {
        isNear: false,
        direction: 'NEUTRAL',
        reason: 'Insufficient data points',
        stochK: 0,
        stochD: 0,
        confirmations: {
          trend: false,
          adx: false,
          stochZone: false,
          srSafe: false,
          candleSafe: false,
          rsiSafe: false,
          volatilitySafe: false
        }
      }
    };
  }

  // A. H4 Trend Check (EMA 200)
  const h4Closes = candlesH4.map(c => c.close);
  const h4Ema200 = calculateEMA(h4Closes, 200);
  const currentH4Ema200 = h4Ema200[h4Ema200.length - 1];
  const currentH4Price = h4Closes[h4Closes.length - 1];
  const isH4Uptrend = currentH4Price > currentH4Ema200;
  const isH4Downtrend = currentH4Price < currentH4Ema200;

  // B. H1 Trend Check (EMA 100)
  const h1Closes = candlesH1.map(c => c.close);
  const h1Ema100 = calculateEMA(h1Closes, 100);
  const currentH1Ema100 = h1Ema100[h1Ema100.length - 1];
  const currentH1Price = h1Closes[h1Closes.length - 1];
  const isH1Uptrend = currentH1Price > currentH1Ema100;
  const isH1Downtrend = currentH1Price < currentH1Ema100;

  // C. 30m Trend & Strength Check (EMA 50 & ADX 14)
  const closes30m = candles30m.map(c => c.close);
  const highs30m = candles30m.map(c => c.high);
  const lows30m = candles30m.map(c => c.low);

  const ema50_30m = calculateEMA(closes30m, 50);
  const current30mEma50 = ema50_30m[ema50_30m.length - 1];
  const current30mPrice = closes30m[closes30m.length - 1];
  const is30mUptrend = current30mPrice > current30mEma50;
  const is30mDowntrend = current30mPrice < current30mEma50;

  const adx14_30m = calculateADX(highs30m, lows30m, closes30m, 14);
  const current30mADX = adx14_30m[adx14_30m.length - 1] || 0;
  const isADXStrong = current30mADX > 25; // High precision filter

  // D. 30m Volatility Filter (ATR 14 vs its SMA 14)
  const atrValues = calculateATR(highs30m, lows30m, closes30m, 14);
  const currentAtr = atrValues[atrValues.length - 1] || 0;
  const atrSma = calculateSMA(atrValues, 14);
  const currentAtrSma = atrSma[atrSma.length - 1] || 0.0001;
  const isVolatilitySafe = currentAtrSma > 0 ? (currentAtr / currentAtrSma) >= 0.6 : true;

  // E. 10m Trigger Crossover Check (Stochastic 14, 3, 3)
  const closes10m = candles10m.map(c => c.close);
  const highs10m = candles10m.map(c => c.high);
  const lows10m = candles10m.map(c => c.low);

  const stoch = calculateStochastic(highs10m, lows10m, closes10m, 14, 3, 3);
  const currentK = stoch.k[stoch.k.length - 1] || 0;
  const currentD = stoch.d[stoch.d.length - 1] || 0;
  const prevK = stoch.k[stoch.k.length - 2] || 0;
  const prevD = stoch.d[stoch.d.length - 2] || 0;

  const isStochCallCrossover = 
    (prevK < 30 && currentK >= 30) || 
    (prevK <= prevD && currentK > currentD && currentK < 30);

  const isStochPutCrossover = 
    (prevK > 70 && currentK <= 70) || 
    (prevK >= prevD && currentK < currentD && currentK > 70);

  // F. 10m RSI Guard
  const rsi14 = calculateRSI(closes10m, 14);
  const currentRsi = rsi14[rsi14.length - 1] || 50;

  // Enforce Trend Alignment
  const isDirectionUptrend = isH4Uptrend && isH1Uptrend && is30mUptrend;
  const isDirectionDowntrend = isH4Downtrend && isH1Downtrend && is30mDowntrend;

  // Execution Signal Trigger
  let initialDirection: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
  if (isDirectionUptrend && isADXStrong && isStochCallCrossover && isVolatilitySafe) {
    initialDirection = 'CALL';
  } else if (isDirectionDowntrend && isADXStrong && isStochPutCrossover && isVolatilitySafe) {
    initialDirection = 'PUT';
  }

  // RSI Check
  let rsiSafe = true;
  if (initialDirection === 'CALL' && currentRsi >= 70) {
    rsiSafe = false;
  } else if (initialDirection === 'PUT' && currentRsi <= 30) {
    rsiSafe = false;
  }

  // Support & Resistance Check on 10m
  const { supports, resistances } = getPivotSR(candles10m);
  let srSafe = true;
  let blockReason = '';
  const currentPrice = closes10m[closes10m.length - 1];
  const thresholdPercent = 0.001; // 0.1% near S/R

  if (initialDirection === 'CALL') {
    for (const r of resistances) {
      if (currentPrice < r && (r - currentPrice) / currentPrice <= thresholdPercent) {
        srSafe = false;
        blockReason = `Resistance zone detected at $${r.toFixed(2)}.`;
        break;
      }
    }
  } else if (initialDirection === 'PUT') {
    for (const s of supports) {
      if (currentPrice > s && (currentPrice - s) / currentPrice <= thresholdPercent) {
        srSafe = false;
        blockReason = `Support zone detected at $${s.toFixed(2)}.`;
        break;
      }
    }
  }

  // Trigger Candle Bullish/Bearish confirmation check (both closed and live 10m candle)
  const currentCandle10m = candles10m[candles10m.length - 1];
  const lastCandle = candles10m[candles10m.length - 2] || currentCandle10m;
  let candleSafe = true;
  if (initialDirection === 'CALL') {
    if (lastCandle.close <= lastCandle.open || currentCandle10m.close < currentCandle10m.open) {
      candleSafe = false;
      blockReason = 'Candle confirmation failed (not bullish).';
    }
  } else if (initialDirection === 'PUT') {
    if (lastCandle.close >= lastCandle.open || currentCandle10m.close > currentCandle10m.open) {
      candleSafe = false;
      blockReason = 'Candle confirmation failed (not bearish).';
    }
  }

  let finalDirection: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
  if (initialDirection !== 'NEUTRAL' && rsiSafe && srSafe && candleSafe) {
    finalDirection = initialDirection;
  }

  // Diagnostics and Watchlist
  let isNear = false;
  let reason = '';
  if (isDirectionUptrend && current30mADX > 18 && isVolatilitySafe) {
    if (currentK < 45 && finalDirection === 'NEUTRAL') {
      isNear = true;
      reason = `Uptrend (ADX ${current30mADX.toFixed(1)}) - Waiting for Stochastic gold cross (K: ${currentK.toFixed(0)}, D: ${currentD.toFixed(0)})`;
    }
  } else if (isDirectionDowntrend && current30mADX > 18 && isVolatilitySafe) {
    if (currentK > 55 && finalDirection === 'NEUTRAL') {
      isNear = true;
      reason = `Downtrend (ADX ${current30mADX.toFixed(1)}) - Waiting for Stochastic death cross (K: ${currentK.toFixed(0)}, D: ${currentD.toFixed(0)})`;
    }
  }

  if (finalDirection === 'NEUTRAL' && !isNear && initialDirection !== 'NEUTRAL') {
    if (!rsiSafe) blockReason = 'RSI is in exhausted zone.';
    reason = `[V3 Blocked] ${blockReason}`;
  }

  return {
    direction: finalDirection,
    adxValue: current30mADX,
    nearEntry: {
      isNear,
      direction: isDirectionUptrend ? 'RISE' : isDirectionDowntrend ? 'FALL' : 'NEUTRAL',
      reason: finalDirection !== 'NEUTRAL' ? 'Entry conditions fully satisfied.' : reason || 'Waiting for setup.',
      stochK: currentK,
      stochD: currentD,
      confirmations: {
        trend: isDirectionUptrend || isDirectionDowntrend,
        adx: isADXStrong,
        stochZone: isDirectionUptrend ? (currentK < 30) : (currentK > 70),
        srSafe,
        candleSafe,
        rsiSafe,
        volatilitySafe: isVolatilitySafe
      }
    }
  };
}

/**
 * 4. Forex 15m Trend-Pullback & Rejection Pro Strategy (v1)
 * Optimized specifically for 15-minute binary options on Forex & Synthetics.
 * Combines 1H & 15m Trend Alignment with 5m EMA 20/50 Value Pullback,
 * RSI momentum health, and strict candle wick rejection anatomy.
 */
export function analyzeForex15mProV1Strategy(
  candlesH1: Candle[],
  candles15m: Candle[],
  candles5m: Candle[]
): {
  direction: 'CALL' | 'PUT' | 'NEUTRAL';
  adxValue: number;
  nearEntry: {
    isNear: boolean;
    direction: 'RISE' | 'FALL' | 'NEUTRAL';
    reason: string;
    stochK?: number;
    stochD?: number;
    confirmations: {
      macroTrend: boolean;
      pullbackZone: boolean;
      rsiHealth: boolean;
      wickRejection: boolean;
      candleColor: boolean;
      srSafe: boolean;
    };
  };
} {
  const defaultRes = {
    direction: 'NEUTRAL' as const,
    adxValue: 0,
    nearEntry: {
      isNear: false,
      direction: 'NEUTRAL' as const,
      reason: 'Insufficient candle data for analysis.',
      stochK: 50,
      stochD: 50,
      confirmations: {
        macroTrend: false,
        pullbackZone: false,
        rsiHealth: false,
        wickRejection: false,
        candleColor: false,
        srSafe: false
      }
    }
  };

  if (candlesH1.length < 30 || candles15m.length < 30 || candles5m.length < 30) {
    return defaultRes;
  }

  // 1. Macro Trend (1H EMA 50 & 15m EMA 20/50 Alignment)
  const h1Closes = candlesH1.map(c => c.close);
  const h1Ema50 = calculateEMA(h1Closes, Math.min(50, h1Closes.length - 1));
  const currentH1Price = h1Closes[h1Closes.length - 1];
  const lastH1Ema50 = h1Ema50[h1Ema50.length - 1] || currentH1Price;

  const m15Closes = candles15m.map(c => c.close);
  const m15Ema20 = calculateEMA(m15Closes, 20);
  const m15Ema50 = calculateEMA(m15Closes, Math.min(50, m15Closes.length - 1));
  const lastM15Ema20 = m15Ema20[m15Ema20.length - 1];
  const lastM15Ema50 = m15Ema50[m15Ema50.length - 1];

  const isH1Uptrend = currentH1Price >= lastH1Ema50;
  const isH1Downtrend = currentH1Price <= lastH1Ema50;

  const is15mUptrend = lastM15Ema20 >= lastM15Ema50;
  const is15mDowntrend = lastM15Ema20 <= lastM15Ema50;

  const isMacroUptrend = isH1Uptrend && is15mUptrend;
  const isMacroDowntrend = isH1Downtrend && is15mDowntrend;

  // 2. 5m Value Zone Pullback & Dynamic EMAs
  const m5Closes = candles5m.map(c => c.close);
  const m5Ema20 = calculateEMA(m5Closes, 20);
  const m5Ema50 = calculateEMA(m5Closes, Math.min(50, m5Closes.length - 1));
  const m5Rsi = calculateRSI(m5Closes, 14);

  const lastM5Ema20 = m5Ema20[m5Ema20.length - 1];
  const lastM5Ema50 = m5Ema50[m5Ema50.length - 1];
  const currentRsi = m5Rsi[m5Rsi.length - 1] || 50;

  const currentCandle = candles5m[candles5m.length - 1];
  const triggerCandle = candles5m[candles5m.length - 2] || currentCandle;

  // Candle Anatomy Metrics on Trigger Candle
  const candleRange = triggerCandle.high - triggerCandle.low;
  const bodyTop = Math.max(triggerCandle.open, triggerCandle.close);
  const bodyBottom = Math.min(triggerCandle.open, triggerCandle.close);
  const lowerWick = bodyBottom - triggerCandle.low;
  const upperWick = triggerCandle.high - bodyTop;

  // Rejection Wick Criteria (at least 20% of range or lower wick exists)
  const isBullishWick = candleRange > 0 ? (lowerWick / candleRange) >= 0.15 : true;
  const isBearishWick = candleRange > 0 ? (upperWick / candleRange) >= 0.15 : true;

  // Value Zone Pullback Proximity (low/high touches or near EMA 20 / EMA 50)
  const distToEma20 = Math.abs(triggerCandle.low - lastM5Ema20) / (triggerCandle.close || 1);
  const distToEma50 = Math.abs(triggerCandle.low - lastM5Ema50) / (triggerCandle.close || 1);
  const isPullbackToSupport = (distToEma20 <= 0.0025 || distToEma50 <= 0.0025 || triggerCandle.low <= lastM5Ema20);

  const distToEma20High = Math.abs(triggerCandle.high - lastM5Ema20) / (triggerCandle.close || 1);
  const distToEma50High = Math.abs(triggerCandle.high - lastM5Ema50) / (triggerCandle.close || 1);
  const isPullbackToResistance = (distToEma20High <= 0.0025 || distToEma50High <= 0.0025 || triggerCandle.high >= lastM5Ema20);

  // RSI Health Zone (Not exhausted, healthy pullback)
  const isRsiHealthyForCall = currentRsi >= 32 && currentRsi <= 58;
  const isRsiHealthyForPut = currentRsi >= 42 && currentRsi <= 68;

  // Candle Confirmation: Green for CALL, Red for PUT
  const isCallCandleConfirmed = triggerCandle.close > triggerCandle.open && currentCandle.close >= currentCandle.open;
  const isPutCandleConfirmed = triggerCandle.close < triggerCandle.open && currentCandle.close <= currentCandle.open;

  // 3. Support / Resistance Obstacle Filter
  const { supports, resistances } = getPivotSR(candles5m);
  let srSafe = true;
  let blockReason = '';
  const currentPrice = currentCandle.close;
  const srThreshold = 0.0015; // 0.15%

  if (isMacroUptrend) {
    for (const r of resistances) {
      if (r > currentPrice && (r - currentPrice) / currentPrice <= srThreshold) {
        srSafe = false;
        blockReason = `Resistance level at ${r.toFixed(4)}. Blocking CALL.`;
        break;
      }
    }
  } else if (isMacroDowntrend) {
    for (const s of supports) {
      if (currentPrice > s && (currentPrice - s) / currentPrice <= srThreshold) {
        srSafe = false;
        blockReason = `Support level at ${s.toFixed(4)}. Blocking PUT.`;
        break;
      }
    }
  }

  // 4. Execution Triggers
  let direction: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';

  if (isMacroUptrend && isPullbackToSupport && isRsiHealthyForCall && isBullishWick && isCallCandleConfirmed && srSafe) {
    direction = 'CALL';
  } else if (isMacroDowntrend && isPullbackToResistance && isRsiHealthyForPut && isBearishWick && isPutCandleConfirmed && srSafe) {
    direction = 'PUT';
  }

  // 5. Watchlist Diagnostics (nearEntry)
  let isNear = false;
  let nearReason = '';

  if (isMacroUptrend) {
    if (currentRsi <= 58 && !isCallCandleConfirmed) {
      isNear = true;
      nearReason = `Bullish Trend (H1/15m) • Pullback in progress (RSI ${currentRsi.toFixed(0)}) • Waiting for Green Rejection Candle at EMA`;
    }
  } else if (isMacroDowntrend) {
    if (currentRsi >= 42 && !isPutCandleConfirmed) {
      isNear = true;
      nearReason = `Bearish Trend (H1/15m) • Pullback in progress (RSI ${currentRsi.toFixed(0)}) • Waiting for Red Rejection Candle at EMA`;
    }
  }

  return {
    direction,
    adxValue: currentRsi,
    nearEntry: {
      isNear,
      direction: isMacroUptrend ? 'RISE' : isMacroDowntrend ? 'FALL' : 'NEUTRAL',
      reason: direction !== 'NEUTRAL' ? 'Entry setup fully triggered.' : nearReason || blockReason || 'Scanning for EMA pullback.',
      stochK: currentRsi,
      stochD: currentRsi,
      confirmations: {
        macroTrend: isMacroUptrend || isMacroDowntrend,
        pullbackZone: isMacroUptrend ? isPullbackToSupport : isMacroDowntrend ? isPullbackToResistance : false,
        rsiHealth: isMacroUptrend ? isRsiHealthyForCall : isMacroDowntrend ? isRsiHealthyForPut : false,
        wickRejection: isMacroUptrend ? isBullishWick : isMacroDowntrend ? isBearishWick : false,
        candleColor: isMacroUptrend ? isCallCandleConfirmed : isMacroDowntrend ? isPutCandleConfirmed : false,
        srSafe
      }
    }
  };
}
