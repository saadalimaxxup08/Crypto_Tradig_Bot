'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Save,
  HelpCircle,
  Sliders,
  CheckSquare,
  Shield,
  Layers,
  Zap,
  Lock,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Terminal
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SYMBOL_DISPLAY_MAP: Record<string, string> = {
  // Step Indices
  stpRNG: 'Step Index',
  stpRNG2: 'Step Index 2',
  stpRNG3: 'Step Index 3',
  stpRNG4: 'Step Index 4',
  stpRNG5: 'Step Index 5',
  // Synthetics Volatility Indices
  R_10: 'Volatility 10 Index',
  R_25: 'Volatility 25 Index',
  R_50: 'Volatility 50 Index',
  R_75: 'Volatility 75 Index',
  R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ15V': 'Volatility 15 (1s) Index',
  '1HZ25V': 'Volatility 25 (1s) Index',
  '1HZ30V': 'Volatility 30 (1s) Index',
  '1HZ50V': 'Volatility 50 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ90V': 'Volatility 90 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  '1HZ150V': 'Volatility 150 (1s) Index',
  '1HZ250V': 'Volatility 250 (1s) Index',
  '1HZ300V': 'Volatility 300 (1s) Index',
  // Boom & Crash & Jump & Range Break
  BOOM50: 'Boom 50 Index',
  BOOM150N: 'Boom 150 Index',
  BOOM300N: 'Boom 300 Index',
  BOOM500: 'Boom 500 Index',
  BOOM600: 'Boom 600 Index',
  BOOM900: 'Boom 900 Index',
  BOOM1000: 'Boom 1000 Index',
  CRASH50: 'Crash 50 Index',
  CRASH150N: 'Crash 150 Index',
  CRASH300N: 'Crash 300 Index',
  CRASH500: 'Crash 500 Index',
  CRASH600: 'Crash 600 Index',
  CRASH900: 'Crash 900 Index',
  CRASH1000: 'Crash 1000 Index',
  JD10: 'Jump 10 Index',
  JD25: 'Jump 25 Index',
  JD50: 'Jump 50 Index',
  JD75: 'Jump 75 Index',
  JD100: 'Jump 100 Index',
  RB100: 'Range Break 100 Index',
  RB200: 'Range Break 200 Index',
  // Forex Majors, Minors & Metals
  frxEURUSD: 'EUR/USD',
  frxGBPUSD: 'GBP/USD',
  frxUSDJPY: 'USD/JPY',
  frxAUDUSD: 'AUD/USD',
  frxUSDCAD: 'USD/CAD',
  frxUSDCHF: 'USD/CHF',
  frxNZDUSD: 'NZD/USD',
  frxEURGBP: 'EUR/GBP',
  frxEURJPY: 'EUR/JPY',
  frxGBPJPY: 'GBP/JPY',
  frxAUDJPY: 'AUD/JPY',
  frxEURAUD: 'EUR/AUD',
  frxEURCAD: 'EUR/CAD',
  frxEURCHF: 'EUR/CHF',
  frxGBPAUD: 'GBP/AUD',
  frxGBPCAD: 'GBP/CAD',
  frxGBPCHF: 'GBP/CHF',
  frxGBPNZD: 'GBP/NZD',
  frxAUDCAD: 'AUD/CAD',
  frxAUDCHF: 'AUD/CHF',
  frxAUDNZD: 'AUD/NZD',
  frxEURNZD: 'EUR/NZD',
  frxNZDJPY: 'NZD/JPY',
  frxXAUUSD: 'Gold / USD',
  frxXAGUSD: 'Silver / USD',
  cryBTCUSD: 'BTC/USD',
  cryETHUSD: 'ETH/USD',
  // OTC/Indices & Baskets
  OTC_NDX: 'US Tech 100 Index',
  OTC_SPC: 'US 500 Index',
  OTC_DJI: 'Wall Street 30 Index',
  OTC_FTSE: 'UK 100 Index',
  OTC_GDAXI: 'Germany 40 Index',
  OTC_FCHI: 'France 40 Index',
  OTC_SX5E: 'Euro 50 Index',
  OTC_N225: 'Japan 225 Index',
  OTC_HSI: 'Hong Kong 50 Index',
  OTC_AS51: 'Australia 200 Index',
  OTC_AEX: 'Netherlands 25 Index',
  OTC_SSMI: 'Swiss 20 Index',
  WLDAUD: 'AUD Basket',
  WLDEUR: 'EUR Basket',
  WLDGBP: 'GBP Basket',
  WLDUSD: 'USD Basket',
  WLDXAU: 'Gold Basket',
  RDBEAR: 'Bear Market Index',
  RDBULL: 'Bull Market Index'
};

const MARTINGALE_STRATEGIES_LIST = [
  { id: 'FOREX_15M_PRO_V1', name: 'v1 - Forex 15m Trend-Rejection Pro', desc: '1H/15m Trend Tide + 5m EMA 20/50 Pullback + Wick Rejection & Color Confirmation + 15m Expiry.' },
  { id: 'FOREX_15M_MTF', name: 'v1 - Forex 15m MTF Crossover', desc: 'H1 Trend Filter + 15m EMA/ADX + 5m Stochastic crossover entry trigger.' },
  { id: 'FOREX_15M_MTF_V2', name: 'v2 - Forex 15m MTF Crossover', desc: 'Adds Support/Resistance and Candlestick Filter validations for higher accuracy.' },
  { id: 'FOREX_30M_MTF_V3', name: 'v1.1 - Forex 30m MTF Crossover', desc: 'Triple Trend (H4/H1/30m) + ATR Volatility Filter + RSI Guard + 30m contracts.' }
];

const MARKET_CATEGORIES = [
  {
    id: 'derived',
    name: '1. Derived Synthetics & Volatilities',
    desc: 'Volatility 10-300 Indices & Step 100-500 Indices',
    pairs: [
      'stpRNG', 'stpRNG2', 'stpRNG3', 'stpRNG4', 'stpRNG5',
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V', '1HZ150V', '1HZ250V', '1HZ300V'
    ]
  },
  {
    id: 'synthetics_jump_boom',
    name: '2. Jump, Boom, Crash & Reset Indices',
    desc: 'Jump 10-100, Boom/Crash 50-1000, Range Break, Bull & Bear Markets',
    pairs: [
      'JD10', 'JD25', 'JD50', 'JD75', 'JD100',
      'BOOM50', 'BOOM150N', 'BOOM300N', 'BOOM500', 'BOOM600', 'BOOM900', 'BOOM1000',
      'CRASH50', 'CRASH150N', 'CRASH300N', 'CRASH500', 'CRASH600', 'CRASH900', 'CRASH1000',
      'RB100', 'RB200', 'RDBULL', 'RDBEAR'
    ]
  },
  {
    id: 'forex',
    name: '3. Forex Majors & Cross Pairs',
    desc: 'EUR/USD, GBP/USD, USD/JPY, AUD, CAD, CHF, NZD Crosses',
    pairs: [
      'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD', 'frxUSDCHF', 'frxNZDUSD',
      'frxEURGBP', 'frxEURJPY', 'frxGBPJPY', 'frxAUDJPY', 'frxEURAUD', 'frxEURCAD', 'frxEURCHF',
      'frxGBPAUD', 'frxGBPCAD', 'frxGBPCHF', 'frxGBPNZD', 'frxAUDCAD', 'frxAUDCHF', 'frxAUDNZD',
      'frxEURNZD', 'frxNZDJPY'
    ]
  },
  {
    id: 'stocks',
    name: '4. Stocks & Index Markets',
    desc: 'US Tech 100, US 500, Wall Street 30, Germany 40, FTSE 100, Japan 225',
    pairs: [
      'OTC_NDX', 'OTC_SPC', 'OTC_DJI', 'OTC_FTSE', 'OTC_GDAXI', 'OTC_FCHI',
      'OTC_SX5E', 'OTC_N225', 'OTC_HSI', 'OTC_AS51', 'OTC_AEX', 'OTC_SSMI'
    ]
  },
  {
    id: 'commodities',
    name: '5. Commodities, Metals & Baskets',
    desc: 'Spot Gold, Silver, BTC, ETH, Currency Baskets (EUR, GBP, USD, Gold)',
    pairs: [
      'frxXAUUSD', 'frxXAGUSD', 'cryBTCUSD', 'cryETHUSD',
      'WLDAUD', 'WLDEUR', 'WLDGBP', 'WLDUSD', 'WLDXAU'
    ]
  }
];

const ALL_AVAILABLE_PAIRS = Object.keys(SYMBOL_DISPLAY_MAP);

export default function MartingaleStrategyPage() {
  const [enabled, setEnabled] = useState(false);
  const [allocatedCapital, setAllocatedCapital] = useState('20.00');
  const [executionMode, setExecutionMode] = useState<'ONE_BY_ONE' | 'ALL_CONCURRENT'>('ONE_BY_ONE');
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    'FOREX_15M_PRO_V1', 'FOREX_15M_MTF', 'FOREX_15M_MTF_V2', 'FOREX_30M_MTF_V3'
  ]);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([
    'stpRNG', 'stpRNG2', 'stpRNG3', 'stpRNG4', 'stpRNG5', '1HZ30V', 'R_100', 'JD75', 'frxUSDJPY', 'frxAUDJPY'
  ]);
  const [progressionSteps, setProgressionSteps] = useState<string[]>([
    '0.35', '0.39', '0.83', '1.75', '3.69', '7.79', '16.45', '34.73', '73.00', '150.00'
  ]);
  const [activeSteps, setActiveSteps] = useState<boolean[]>([
    true, true, true, true, true, true, true, true, true, true
  ]);

  const [newsFilterEnabled, setNewsFilterEnabled] = useState(true);
  const [sessionFilterEnabled, setSessionFilterEnabled] = useState(true);
  const [cooldownFilterEnabled, setCooldownFilterEnabled] = useState(true);
  const [dailyLimitEnabled, setDailyLimitEnabled] = useState(true);
  const [isSavingRiskToggles, setIsSavingRiskToggles] = useState(false);

  const [stats, setStats] = useState<any>({
    totalTrades: 0,
    wonCount: 0,
    lostCount: 0,
    openCount: 0,
    totalPnL: 0,
    winRate: 0,
    allocatedCapital: 20.00,
    demoBalance: 0.00,
    realBalance: 0.00,
    activeBalance: 0.00
  });

  const [tradingMode, setTradingMode] = useState<'DEMO' | 'REAL'>('DEMO');
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [nearEntryPairs, setNearEntryPairs] = useState<any[]>([]);

  // Deduplicate and sort nearEntryPairs so highest probability signals rank at the top
  const sortedNearEntryPairs = useMemo(() => {
    if (!nearEntryPairs || !Array.isArray(nearEntryPairs)) return [];

    const uniqueMap = new Map<string, any>();
    nearEntryPairs.forEach(p => {
      if (!p || !p.symbol) return;
      const existing = uniqueMap.get(p.symbol);
      if (!existing) {
        uniqueMap.set(p.symbol, p);
      } else {
        const pTrig = p.direction === 'RISE' || p.direction === 'FALL';
        const exTrig = existing.direction === 'RISE' || existing.direction === 'FALL';
        if (pTrig && !exTrig) {
          uniqueMap.set(p.symbol, p);
        } else if (pTrig === exTrig && (parseFloat(p.adx || 0) > parseFloat(existing.adx || 0))) {
          uniqueMap.set(p.symbol, p);
        }
      }
    });

    const uniqueList = Array.from(uniqueMap.values());

    return uniqueList.sort((a, b) => {
      const aTrig = (a.direction === 'RISE' || a.direction === 'FALL') ? 3 : 0;
      const bTrig = (b.direction === 'RISE' || b.direction === 'FALL') ? 3 : 0;

      const scoreA = aTrig + (a.confirmations?.trend ? 1 : 0) + (a.confirmations?.adx ? 1 : 0) + (a.confirmations?.stochZone ? 1 : 0) + (parseFloat(a.adx || 0) > 0 ? 0.5 : 0);
      const scoreB = bTrig + (b.confirmations?.trend ? 1 : 0) + (b.confirmations?.adx ? 1 : 0) + (b.confirmations?.stochZone ? 1 : 0) + (parseFloat(b.adx || 0) > 0 ? 0.5 : 0);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return parseFloat(b.adx || 0) - parseFloat(a.adx || 0);
    });
  }, [nearEntryPairs]);
  const [isScanning, setIsScanning] = useState(false);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [tradeFilter, setTradeFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchMartingaleData = async (forceUpdateState = false) => {
    try {
      const res = await fetch('/api/deriv/martingale');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          if (!isInitialLoaded || forceUpdateState) {
            setEnabled(Boolean(data.config.enabled));
            setTradingMode(data.config.trading_mode || 'DEMO');
            setAllocatedCapital(String(data.config.allocated_capital || '20.00'));
            setExecutionMode(data.config.execution_mode || 'ONE_BY_ONE');
            if (Array.isArray(data.config.selected_strategies)) {
              setSelectedStrategies(data.config.selected_strategies);
            }
            if (Array.isArray(data.config.selected_pairs)) {
              setSelectedPairs(data.config.selected_pairs);
            }
            if (Array.isArray(data.config.progression_steps) && data.config.progression_steps.length === 10) {
              setProgressionSteps(data.config.progression_steps.map((s: any) => String(s)));
            }
            if (Array.isArray(data.config.progression_active_steps) && data.config.progression_active_steps.length === 10) {
              setActiveSteps(data.config.progression_active_steps.map((b: any) => Boolean(b)));
            }
            if (data.riskFilters) {
              setNewsFilterEnabled(data.riskFilters.news !== false);
              setSessionFilterEnabled(data.riskFilters.session !== false);
              setCooldownFilterEnabled(data.riskFilters.cooldown !== false);
              setDailyLimitEnabled(data.riskFilters.daily !== false);
            }
            setIsInitialLoaded(true);
          }
        }
        if (data.nearEntryPairs && Array.isArray(data.nearEntryPairs)) {
          setNearEntryPairs(data.nearEntryPairs);
        }
        if (data.lastScanLogs && Array.isArray(data.lastScanLogs) && data.lastScanLogs.length > 0) {
          setScanLogs(data.lastScanLogs);
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.openTrades) {
          setOpenTrades(data.openTrades);
        }
        if (data.recentTrades) {
          setRecentTrades(data.recentTrades);
        }
      }
    } catch (err) {
      console.error('Failed to load Martingale Strategy data:', err);
    }
  };

  useEffect(() => {
    const initPage = async () => {
      await fetchMartingaleData(true);
      // Auto-trigger instant scan on page load so terminal console & watchlist are never blank
      handleRunInstantScan();
    };
    initPage();

    const dataInterval = setInterval(() => fetchMartingaleData(false), 25000);
    const scanInterval = setInterval(() => handleRunInstantScan(), 20000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(scanInterval);
    };
  }, []);

  const toggleStrategy = (id: string) => {
    if (selectedStrategies.includes(id)) {
      setSelectedStrategies(selectedStrategies.filter(s => s !== id));
    } else {
      setSelectedStrategies([...selectedStrategies, id]);
    }
  };

  const selectAllStrategies = () => {
    setSelectedStrategies(MARTINGALE_STRATEGIES_LIST.map(s => s.id));
  };

  const clearAllStrategies = () => {
    setSelectedStrategies([]);
  };

  const handleTradingModeChange = async (mode: 'DEMO' | 'REAL') => {
    setTradingMode(mode);
    try {
      const res = await fetch('/api/deriv/martingale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          trading_mode: mode,
          allocated_capital: parseFloat(allocatedCapital) || 20.00,
          execution_mode: executionMode,
          selected_strategies: selectedStrategies,
          selected_pairs: selectedPairs,
          progression_steps: progressionSteps.map(s => parseFloat(s) || 0.35),
          progression_active_steps: activeSteps,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled
          }
        })
      });
      if (res.ok) {
        setStatusMsg({
          type: 'success',
          text: `Martingale Account Mode switched to ${mode === 'REAL' ? 'REAL LIVE ACCOUNT' : 'DEMO VIRTUAL SANDBOX'}!`
        });
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Error changing trading mode:', err);
    }
  };

  const handleRunInstantScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/deriv/martingale-cron');
      if (res.ok) {
        const data = await res.json();
        if (data.logs && Array.isArray(data.logs)) {
          setScanLogs(data.logs);
        }
        if (data.nearEntryPairs && Array.isArray(data.nearEntryPairs)) {
          setNearEntryPairs(data.nearEntryPairs);
        }
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Failed to trigger instant scan:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleEngine = async () => {
    const nextState = !enabled;
    setEnabled(nextState);
    try {
      const res = await fetch('/api/deriv/martingale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: nextState,
          trading_mode: tradingMode,
          allocated_capital: parseFloat(allocatedCapital) || 20.00,
          execution_mode: executionMode,
          selected_strategies: selectedStrategies,
          selected_pairs: selectedPairs,
          progression_steps: progressionSteps.map(s => parseFloat(s) || 0.35),
          progression_active_steps: activeSteps,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled
          }
        })
      });
      if (res.ok) {
        setStatusMsg({
          type: 'success',
          text: `Martingale Engine status set to WORK ${nextState ? 'ON (RUNNING)' : 'OFF (PAUSED)'}!`
        });
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Error toggling master engine:', err);
    }
  };

  const handleExecutionModeChange = async (mode: 'ONE_BY_ONE' | 'ALL_CONCURRENT') => {
    setExecutionMode(mode);
    try {
      const res = await fetch('/api/deriv/martingale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          trading_mode: tradingMode,
          allocated_capital: parseFloat(allocatedCapital) || 20.00,
          execution_mode: mode,
          selected_strategies: selectedStrategies,
          selected_pairs: selectedPairs,
          progression_steps: progressionSteps.map(s => parseFloat(s) || 0.35),
          progression_active_steps: activeSteps,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled
          }
        })
      });
      if (res.ok) {
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Error changing execution mode:', err);
    }
  };

  const handleToggleRiskFilter = async (filterType: string, currentValue: boolean) => {
    setIsSavingRiskToggles(true);
    const newValue = !currentValue;

    let news = newsFilterEnabled;
    let session = sessionFilterEnabled;
    let cooldown = cooldownFilterEnabled;
    let daily = dailyLimitEnabled;

    if (filterType === 'news') { setNewsFilterEnabled(newValue); news = newValue; }
    if (filterType === 'session') { setSessionFilterEnabled(newValue); session = newValue; }
    if (filterType === 'cooldown') { setCooldownFilterEnabled(newValue); cooldown = newValue; }
    if (filterType === 'daily') { setDailyLimitEnabled(newValue); daily = newValue; }

    try {
      const res = await fetch('/api/deriv/martingale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          trading_mode: tradingMode,
          allocated_capital: parseFloat(allocatedCapital) || 20.00,
          execution_mode: executionMode,
          selected_strategies: selectedStrategies,
          selected_pairs: selectedPairs,
          progression_steps: progressionSteps.map(s => parseFloat(s) || 0.35),
          progression_active_steps: activeSteps,
          riskFilters: {
            news,
            session,
            cooldown,
            daily
          }
        })
      });
      if (res.ok) {
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Error toggling risk filter:', err);
    } finally {
      setIsSavingRiskToggles(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const res = await fetch('/api/deriv/martingale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          trading_mode: tradingMode,
          allocated_capital: parseFloat(allocatedCapital) || 20.00,
          execution_mode: executionMode,
          selected_strategies: selectedStrategies,
          selected_pairs: selectedPairs,
          progression_steps: progressionSteps.map(s => parseFloat(s) || 0.35),
          progression_active_steps: activeSteps,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ type: 'success', text: 'Martingale Strategy Engine settings saved successfully!' });
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#3b82f6']
        });
        await fetchMartingaleData(true);
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save settings.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePair = (pair: string) => {
    if (selectedPairs.includes(pair)) {
      setSelectedPairs(selectedPairs.filter(p => p !== pair));
    } else {
      setSelectedPairs([...selectedPairs, pair]);
    }
  };

  const selectAllPairs = () => setSelectedPairs([...ALL_AVAILABLE_PAIRS]);
  const clearAllPairs = () => setSelectedPairs([]);

  const selectCategoryPairs = (categoryPairs: string[]) => {
    const combined = Array.from(new Set([...selectedPairs, ...categoryPairs]));
    setSelectedPairs(combined);
  };

  const clearCategoryPairs = (categoryPairs: string[]) => {
    setSelectedPairs(selectedPairs.filter(p => !categoryPairs.includes(p)));
  };

  if (!isInitialLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold text-zinc-400">Loading Martingale Strategy Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#0c0c0f]/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
                  Martingale Strategy Engine
                </h1>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                  enabled
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}>
                  {enabled ? 'WORK ON (ACTIVE)' : 'WORK OFF (INACTIVE)'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Isolated Martingale progression sandbox. Runs independently with custom capital allocation and sequential One-by-One safety lock.
              </p>
            </div>
          </div>
        </div>

        {/* Master ON / OFF Switch */}
        <div className="flex items-center gap-4 bg-[#09090b]/90 border border-zinc-800 p-3 rounded-2xl relative z-10 self-start md:self-auto">
          <div className="text-right">
            <span className="block text-xs font-bold text-zinc-300">Engine Status</span>
            <span className={`text-[10px] font-extrabold uppercase ${enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {enabled ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleEngine}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none ${
              enabled ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                enabled ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Martingale Account Mode Switch Card (DEMO vs REAL) */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Independent Martingale Trading Account Mode</span>
            </h3>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
              tradingMode === 'REAL'
                ? 'bg-rose-950/60 text-rose-400 border-rose-500/40 animate-pulse'
                : 'bg-amber-950/60 text-amber-400 border-amber-500/40'
            }`}>
              {tradingMode === 'REAL' ? 'REAL LIVE ACCOUNT' : 'DEMO VIRTUAL SANDBOX'}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Switch Martingale Engine between Demo Virtual Practice and Real Live Account independently without affecting main bot testing.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 p-1 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => handleTradingModeChange('DEMO')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              tradingMode === 'DEMO'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            DEMO VIRTUAL
          </button>
          <button
            type="button"
            onClick={() => handleTradingModeChange('REAL')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              tradingMode === 'REAL'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            REAL LIVE CAPITAL
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMsg.text && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 transition-all ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Martingale Dedicated Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Deriv Wallet Balance (Chota label + Badge) */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Deriv Wallet</span>
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
              tradingMode === 'REAL' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : 'bg-amber-950/60 text-amber-400 border-amber-500/30'
            }`}>
              {tradingMode === 'REAL' ? 'REAL' : 'DEMO'}
            </span>
          </div>
          <div className="text-xl font-black font-mono text-zinc-100 flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>{(tradingMode === 'REAL' ? (stats.realBalance || 0) : (stats.demoBalance || 0)).toFixed(2)}</span>
          </div>
          <p className="text-[9px] text-zinc-500">Deriv main account wallet balance</p>
        </div>

        {/* Card 2: Allocated Martingale Capital Pool (Dynamic Pool) */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Remaining Capital Pool</span>
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
              (stats.totalPnL || 0) >= 0 ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
            }`}>
              {(stats.totalPnL || 0) >= 0 ? 'PROFIT' : 'DRAWDOWN'}
            </span>
          </div>
          <div className={`text-xl font-black font-mono flex items-center gap-1 ${(parseFloat(allocatedCapital) + (stats.totalPnL || 0)) >= parseFloat(allocatedCapital) ? 'text-emerald-400' : 'text-rose-400'}`}>
            <DollarSign className="w-4 h-4" />
            <span>{(parseFloat(allocatedCapital) + (stats.totalPnL || 0)).toFixed(2)}</span>
          </div>
          <p className="text-[9px] text-zinc-500">Base: ${parseFloat(allocatedCapital).toFixed(2)} | Net: {(stats.totalPnL || 0) >= 0 ? '+' : ''}${(stats.totalPnL || 0).toFixed(2)}</p>
        </div>

        {/* Card 3: Martingale Isolated Total PnL */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Martingale Isolated PnL</span>
          <div className={`text-xl font-black font-mono ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
          </div>
          <p className="text-[9px] text-zinc-500">{stats.wonCount} Won / {stats.lostCount} Lost (Isolated)</p>
        </div>

        {/* Card 4: Execution Mode */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Execution Mode</span>
          <div className="text-md font-black text-emerald-400 flex items-center gap-1.5 pt-0.5">
            {executionMode === 'ONE_BY_ONE' ? <Lock className="w-3.5 h-3.5 text-emerald-400" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{executionMode === 'ONE_BY_ONE' ? 'One-By-One' : 'Multi-Trade'}</span>
          </div>
          <p className="text-[9px] text-zinc-500">Sequential trade entry lock</p>
        </div>

        {/* Card 5: Martingale Win Rate */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 space-y-1 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Martingale Win Rate</span>
          <div className="text-xl font-black font-mono text-zinc-100">
            {stats.winRate.toFixed(1)}%
          </div>
          <p className="text-[9px] text-zinc-500">Total {stats.totalTrades} Martingale trades</p>
        </div>
      </div>

      {/* Active Safety & News Filters Card */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/50 pb-3">
          <div>
            <h3 className="text-md font-bold text-zinc-200 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>Active Safety &amp; News Filters</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live automated risk control filters protecting your Martingale Strategy capital.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* News Filter Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('news', newsFilterEnabled)}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              newsFilterEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">News Blocker</span>
            <span className="text-[9px] opacity-60 mt-0.5">USD/EUR/GBP High Impact</span>
            <span className={`text-[10px] font-black mt-2.5 px-2.5 py-0.5 rounded-lg ${newsFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
              {newsFilterEnabled ? 'GUARD ON' : 'GUARD OFF'}
            </span>
          </button>

          {/* Session Filter Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('session', sessionFilterEnabled)}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              sessionFilterEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Asian Session</span>
            <span className="text-[9px] opacity-60 mt-0.5">21:00 - 23:59 GMT Block</span>
            <span className={`text-[10px] font-black mt-2.5 px-2.5 py-0.5 rounded-lg ${sessionFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
              {sessionFilterEnabled ? 'GUARD ON' : 'GUARD OFF'}
            </span>
          </button>

          {/* Loss Cooldown Guard Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('cooldown', cooldownFilterEnabled)}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              cooldownFilterEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Loss Cooldown</span>
            <span className="text-[9px] opacity-60 mt-0.5">2 Losses = 60m Cooldown</span>
            <span className={`text-[10px] font-black mt-2.5 px-2.5 py-0.5 rounded-lg ${cooldownFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
              {cooldownFilterEnabled ? 'GUARD ON' : 'GUARD OFF'}
            </span>
          </button>

          {/* Daily Trades Limit Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('daily', dailyLimitEnabled)}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center cursor-pointer ${
              dailyLimitEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Daily Trade Limit</span>
            <span className="text-[9px] opacity-60 mt-0.5">Max 10 Trades Limit</span>
            <span className={`text-[10px] font-black mt-2.5 px-2.5 py-0.5 rounded-lg ${dailyLimitEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
              {dailyLimitEnabled ? 'GUARD ON' : 'GUARD OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Martingale Pairs Near Entry Watchlist Table Card */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-3 gap-2">
          <div>
            <h3 className="text-md font-bold text-zinc-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Martingale Pairs Near Entry Watchlist ({sortedNearEntryPairs.length} Active)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live monitoring of pairs evaluated near trade entry thresholds for Martingale execution.
            </p>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {sortedNearEntryPairs.length > 0 ? `${sortedNearEntryPairs.length} unique active pairs analyzed in current scan cycle` : 'Scanning active pairs...'}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[310px] overflow-y-auto rounded-2xl border border-zinc-900 bg-[#050507]/60 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="sticky top-0 z-10 bg-zinc-950 shadow-sm">
              <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Asset Pair</th>
                <th className="py-3 px-3">Signal Direction</th>
                <th className="py-3 px-3">Proximity Status</th>
                <th className="py-3 px-3 text-right">Confirmations (T A S)</th>
                <th className="py-3 px-3 text-right">ADX</th>
                <th className="py-3 px-4 text-right">Stoch %K / %D</th>
                <th className="py-3 px-4 text-center">Deriv Live Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-300 font-medium">
              {sortedNearEntryPairs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs italic">
                    No pairs currently near entry criteria. Click "Run Scan &amp; Analysis Now" below to run live scanner!
                  </td>
                </tr>
              ) : (
                sortedNearEntryPairs.map((pair: any, idx: number) => (
                  <tr key={idx} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-zinc-100">
                      {SYMBOL_DISPLAY_MAP[pair.symbol] || pair.symbol}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        pair.direction === 'RISE' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' :
                        pair.direction === 'FALL' ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30' :
                        'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                      }`}>
                        {pair.direction === 'RISE' ? '↗️ RISE (CALL)' : pair.direction === 'FALL' ? '↘️ FALL (PUT)' : '🔍 ANALYZING'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-400 text-xs">
                      {pair.reason}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          title="Trend Alignment"
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border ${
                            pair.confirmations?.trend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                        >
                          T
                        </span>
                        <span
                          title="ADX Momentum"
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border ${
                            pair.confirmations?.adx ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                        >
                          A
                        </span>
                        <span
                          title="Stochastic Zone"
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border ${
                            pair.confirmations?.stochZone ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                        >
                          S
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-zinc-200">
                      {parseFloat(pair.adx || 0).toFixed(1)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-400">
                      {parseFloat(pair.stochK || 50).toFixed(0)} / {parseFloat(pair.stochD || 50).toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <a
                        href={`https://dtrader.deriv.com/?chart_type=candle&interval=5m&symbol=${pair.symbol}&trade_type=rise_fall`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-3 py-1 text-[10px] font-black text-amber-400 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 rounded-lg transition-all uppercase tracking-wider font-mono"
                      >
                        Go Live Chart
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-3 gap-3">
          <div>
            <h3 className="text-md font-bold text-zinc-200 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <span>Live Martingale Analysis &amp; Scanner Feed</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Real-time console monitoring all active pair scans, signal evaluations, filter rejections, and One-By-One trade locks.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunInstantScan}
            disabled={isScanning}
            className="flex items-center gap-2 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Pairs...' : 'Run Scan & Analysis Now'}</span>
          </button>
        </div>

        <div className="bg-[#08080a] border border-zinc-900 rounded-2xl p-4 font-mono text-xs max-h-60 overflow-y-auto space-y-1.5 leading-relaxed text-zinc-300">
          {scanLogs.length === 0 ? (
            <div className="text-zinc-600 text-center py-6">
              No recent scan logs. Click "Run Scan &amp; Analysis Now" or wait for automated background scanner execution.
            </div>
          ) : (
            scanLogs.map((logLine, idx) => {
              const isTrade = logLine.includes('TRADE EXECUTED') || logLine.includes('WON') || logLine.includes('PLACED');
              const isReject = logLine.includes('REJECTED') || logLine.includes('SKIP') || logLine.includes('BLOCKED');
              const isInfo = logLine.includes('SCAN');

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    isTrade ? 'text-emerald-400 font-bold' :
                    isReject ? 'text-amber-400/90' :
                    isInfo ? 'text-cyan-400/90' : 'text-zinc-400'
                  }`}
                >
                  <span className="text-zinc-600 select-none">&gt;</span>
                  <span className="break-all">{logLine}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Control 1: Allocated Capital Pool & Execution Mode */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
        <h3 className="text-lg font-bold text-zinc-200 border-b border-zinc-800/50 pb-3 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <span>Capital Allocation &amp; Execution Mode Controls</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Allocated Capital Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <span>Allocated Martingale Capital Pool</span>
              <span title="Amount in USD dedicated solely for Martingale execution"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="5.00"
                value={allocatedCapital}
                onChange={(e) => setAllocatedCapital(e.target.value)}
                className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none text-sm"
              />
              <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                USD
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-zinc-500 gap-1 pt-1">
              <span>Only this pool will be tracked. Main strategy testing funds remain completely untouched.</span>
              <span className="font-mono font-bold text-zinc-300 shrink-0">
                Deriv Wallet ({tradingMode}): ${(tradingMode === 'REAL' ? (stats.realBalance || 0) : (stats.demoBalance || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Execution Mode Radio Cards */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <span>Trade Execution Mode</span>
              <span title="Controls single trade sequential locking vs multi-trade entries"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => handleExecutionModeChange('ONE_BY_ONE')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  executionMode === 'ONE_BY_ONE'
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-[#09090b]/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> One-By-One
                  </span>
                  <CheckSquare className={`w-4 h-4 ${executionMode === 'ONE_BY_ONE' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  Single trade sequential lock. Waits for expiry before next entry.
                </p>
              </div>

              <div
                onClick={() => handleExecutionModeChange('ALL_CONCURRENT')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  executionMode === 'ALL_CONCURRENT'
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-[#09090b]/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> All Concurrent
                  </span>
                  <CheckSquare className={`w-4 h-4 ${executionMode === 'ALL_CONCURRENT' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                </div>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  Allows multiple concurrent trades across pairs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control 2: Custom 10-Step Progression & Recovery Table */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-4 gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>Custom 10-Step Progression &amp; Recovery Table</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
              Tick the steps you want to activate. When a trade loses, the bot moves to the next <b>ticked step</b>. As soon as <b>ANY trade WINS</b>, the bot resets back to Step 1. If <b>all ticked steps lose</b>, trading is automatically HALTED for risk protection!
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold py-2.5 px-5 rounded-2xl shadow-lg shadow-emerald-950/40 transition-all shrink-0 active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Steps...' : 'Save Progression Steps'}</span>
          </button>
        </div>

        {/* 10 Step Inputs Grid with Checkboxes */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {progressionSteps.map((stepVal, idx) => {
            const isChecked = activeSteps[idx] !== false;
            const isActiveStep = idx === (stats.currentStepIndex ?? 0);

            return (
              <div
                key={idx}
                className={`border rounded-2xl p-3.5 space-y-2.5 transition-all relative ${
                  isActiveStep
                    ? 'bg-amber-950/30 border-amber-400/90 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse text-amber-100'
                    : isChecked
                    ? 'bg-[#09090b]/80 border-emerald-500/40 text-zinc-100'
                    : 'bg-zinc-950/40 border-zinc-800/60 opacity-60 text-zinc-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const newFlags = [...activeSteps];
                        newFlags[idx] = e.target.checked;
                        setActiveSteps(newFlags);
                      }}
                      className="rounded border-zinc-800 text-emerald-500 focus:ring-0 accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className={`text-[11px] font-extrabold uppercase tracking-wide ${
                      isActiveStep ? 'text-amber-300' : isChecked ? 'text-emerald-400' : 'text-zinc-500'
                    }`}>
                      Step {idx + 1}
                    </span>
                  </label>

                  {isActiveStep ? (
                    <span className="text-[9px] font-black bg-amber-400 text-black px-1.5 py-0.5 rounded-md tracking-wider flex items-center gap-0.5 shadow-sm">
                      ⚡ NEXT TRADE
                    </span>
                  ) : idx === 0 ? (
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md">
                      RESET
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.35"
                    disabled={!isChecked}
                    value={stepVal}
                    onChange={(e) => {
                      const newSteps = [...progressionSteps];
                      newSteps[idx] = e.target.value;
                      setProgressionSteps(newSteps);
                    }}
                    className={`w-full border rounded-xl py-2 px-3 font-mono text-xs focus:outline-none transition-all ${
                      isActiveStep
                        ? 'bg-[#0c0c0f] border-amber-500/80 text-amber-200 font-black ring-1 ring-amber-400/40'
                        : isChecked
                        ? 'bg-[#0c0c0f] border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 text-zinc-100'
                        : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
                    }`}
                  />
                  <span className={`absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] font-bold ${
                    isActiveStep ? 'text-amber-400' : 'text-zinc-500'
                  }`}>
                    USD
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progression Table Active Steps Summary Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-zinc-800/50 pt-4 gap-2">
          <span className="text-xs text-zinc-400">
            Active Steps Enabled: <b className="text-emerald-400">{activeSteps.filter(Boolean).length} / 10</b>
          </span>
          <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-xl animate-pulse">
            <span>⚡ Next Trade Execution Stake:</span>
            <b className="text-amber-300 underline font-black">
              Step {(stats.currentStepIndex ?? 0) + 1} (${stats.nextStake !== undefined ? Number(stats.nextStake).toFixed(2) : (progressionSteps[stats.currentStepIndex ?? 0] || '0.35')})
            </b>
          </span>
        </div>
      </div>

      {/* Control 3: Dedicated Martingale Active Strategy Engines */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-4 gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>Dedicated Martingale Active Strategy Engines ({selectedStrategies.length} Active)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Tick whichever strategy engines you want to run for Martingale trade execution. You can tick one, multiple, or all 4 strategies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllStrategies}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAllStrategies}
              className="text-xs bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Strategy Configuration'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MARTINGALE_STRATEGIES_LIST.map((strat) => {
            const isSelected = selectedStrategies.includes(strat.id);
            return (
              <div
                key={strat.id}
                onClick={() => toggleStrategy(strat.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                  isSelected
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-[#09090b]/60 border-zinc-800/80 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zinc-100 flex items-center gap-1.5">
                    <span>{strat.name}</span>
                  </span>
                  <CheckSquare className={`w-4.5 h-4.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-700'}`} />
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  {strat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Control 4: Dedicated Martingale Pair Selector (5 Market Categories) */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-4 gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>Dedicated Martingale Scanned Pairs ({selectedPairs.length} Active Across 5 Categories)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Select pairs for Martingale execution organized across 5 separate market categories. Use quick category selectors or toggle individual asset pairs.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={selectAllPairs}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              Select All (88)
            </button>
            <button
              type="button"
              onClick={clearAllPairs}
              className="text-xs bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Selected Pairs'}</span>
            </button>
          </div>
        </div>

        {/* 5 Categorized Market Containers */}
        <div className="space-y-6">
          {MARKET_CATEGORIES.map((cat) => {
            const activeInCatCount = cat.pairs.filter(p => selectedPairs.includes(p)).length;
            const isAllCatSelected = activeInCatCount === cat.pairs.length;

            return (
              <div key={cat.id} className="bg-[#08080b]/80 border border-zinc-850 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-extrabold text-zinc-200 uppercase tracking-wider">{cat.name}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                      activeInCatCount > 0
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                    }`}>
                      {activeInCatCount} / {cat.pairs.length} Active
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectCategoryPairs(cat.pairs)}
                      className="text-[10px] bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      Select All Category
                    </button>
                    <button
                      type="button"
                      onClick={() => clearCategoryPairs(cat.pairs)}
                      className="text-[10px] bg-zinc-900 hover:bg-zinc-850 text-zinc-500 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      Clear Category
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 italic">{cat.desc}</p>

                {/* Category Pair Grid with vertical scrollbar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                  {cat.pairs.map((pair) => {
                    const isSelected = selectedPairs.includes(pair);
                    const displayName = SYMBOL_DISPLAY_MAP[pair] || pair;
                    return (
                      <div
                        key={pair}
                        onClick={() => togglePair(pair)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300 shadow-sm'
                            : 'bg-[#060608]/80 border-zinc-800/80 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        <span className="text-[11px] font-extrabold truncate pr-1">{displayName}</span>
                        <CheckSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-750'}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Settings Footer */}
      <div className="flex items-center justify-between bg-[#0c0c0f]/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6">
        <p className="text-xs text-zinc-400">
          Save your dedicated Martingale strategy parameters, progression steps, and pair filters.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold py-3 px-6 rounded-2xl shadow-xl shadow-emerald-950/50 transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4.5 h-4.5" />
          <span>{isSaving ? 'Saving Settings...' : 'Save Martingale Settings'}</span>
        </button>
      </div>

      {/* Martingale Active Positions Terminal (OPEN Trades) */}
      {openTrades.length > 0 && (
        <div className="bg-emerald-950/20 backdrop-blur-xl border border-emerald-500/40 rounded-3xl p-6 space-y-4 shadow-xl shadow-emerald-950/20">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
            <h3 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 animate-pulse text-emerald-400" />
              <span>Active Running Martingale Position ({openTrades.length})</span>
            </h3>
            <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl uppercase tracking-wider animate-pulse">
              One-By-One Lock Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {openTrades.map((t) => (
              <div key={t.id} className="bg-[#09090b]/90 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-100">{SYMBOL_DISPLAY_MAP[t.symbol] || t.symbol}</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${t.contract_type === 'CALL' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-400 border border-rose-500/30'}`}>
                    {t.contract_type === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <span className="text-zinc-400">Stake:</span>
                  <span className="font-extrabold text-emerald-400">${(parseFloat(t.stake) || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Entry Spot:</span>
                  <span className="font-bold text-zinc-200">{t.entry_price ? parseFloat(t.entry_price).toFixed(4) : 'N/A'}</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono text-right pt-1">
                  Open Time: {new Date(t.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dedicated Martingale Trades History Table */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-4 gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <span>Dedicated Martingale Trades History Ledger</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Complete history of trades executed exclusively by the Martingale Progression Engine.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 p-1 rounded-2xl shrink-0">
            <button
              type="button"
              onClick={() => setTradeFilter('all')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${tradeFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              All ({recentTrades.length})
            </button>
            <button
              type="button"
              onClick={() => setTradeFilter('won')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${tradeFilter === 'won' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Won ({recentTrades.filter(t => t.status === 'WON').length})
            </button>
            <button
              type="button"
              onClick={() => setTradeFilter('lost')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${tradeFilter === 'lost' ? 'bg-rose-950 text-rose-400 border border-rose-500/30' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Lost ({recentTrades.filter(t => t.status === 'LOST').length})
            </button>
          </div>
        </div>

        {(() => {
          const filtered = recentTrades.filter(t => {
            if (tradeFilter === 'won') return t.status === 'WON';
            if (tradeFilter === 'lost') return t.status === 'LOST';
            return true;
          });

          if (filtered.length === 0) {
            return (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No Martingale trades found for the selected filter. Enable Martingale Strategy Engine to start!
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                    <th className="pb-3">Symbol / Asset</th>
                    <th className="pb-3">Direction</th>
                    <th className="pb-3">Entry Spot</th>
                    <th className="pb-3">Exit Spot</th>
                    <th className="pb-3">Stake</th>
                    <th className="pb-3">Net Return</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Close Time (Jeddah)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {filtered.map((t) => {
                    const pnlVal = parseFloat(t.pnl) || 0;
                    const isWon = t.status === 'WON' || pnlVal > 0;
                    const isLost = t.status === 'LOST' || pnlVal < 0;
                    return (
                      <tr key={t.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 font-extrabold text-zinc-100">{SYMBOL_DISPLAY_MAP[t.symbol] || t.symbol}</td>
                        <td className="py-3 font-extrabold">
                          <span className={t.contract_type === 'CALL' ? 'text-emerald-400' : 'text-rose-400'}>
                            {t.contract_type === 'CALL' ? 'RISE' : 'FALL'}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-400">{t.entry_price ? parseFloat(t.entry_price).toFixed(4) : 'N/A'}</td>
                        <td className="py-3 text-zinc-400">{t.exit_price ? parseFloat(t.exit_price).toFixed(4) : 'N/A'}</td>
                        <td className="py-3 font-bold text-zinc-200">${(parseFloat(t.stake) || 0).toFixed(2)}</td>
                        <td className={`py-3 font-extrabold ${pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            isWon ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' :
                            isLost ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30' :
                            'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-500 text-[11px] text-right font-mono">
                          {t.closed_at ? new Date(t.closed_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }) : new Date(t.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
