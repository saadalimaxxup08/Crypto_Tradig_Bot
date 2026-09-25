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
  Terminal,
  ChevronDown,
  ChevronUp,
  ExternalLink
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
  const [progressionMode, setProgressionMode] = useState<'USD' | 'PERCENTAGE'>('USD');
  const [portfolioPrice, setPortfolioPrice] = useState('20.00');
  const [percentageSteps, setPercentageSteps] = useState<string[]>([
    '1.75', '1.95', '4.15', '8.75', '18.45', '38.95', '82.25', '173.65', '365.00', '750.00'
  ]);
  const [autoCompoundEnabled, setAutoCompoundEnabled] = useState<boolean>(false);

  const handleRecalculateUsdStakes = (priceStr: string, pctArr: string[]) => {
    const capital = parseFloat(priceStr) || 0;
    const newUsdSteps = pctArr.map(pctStr => {
      const pct = parseFloat(pctStr) || 0;
      const computed = (capital * pct) / 100;
      const finalUsd = Math.max(0.35, Math.round(computed * 100) / 100);
      return finalUsd.toFixed(2);
    });
    setProgressionSteps(newUsdSteps);
  };

  const [newsFilterEnabled, setNewsFilterEnabled] = useState(true);
  const [sessionFilterEnabled, setSessionFilterEnabled] = useState(true);
  const [cooldownFilterEnabled, setCooldownFilterEnabled] = useState(true);
  const [dailyLimitEnabled, setDailyLimitEnabled] = useState(true);
  const [pairLossCooldownEnabled, setPairLossCooldownEnabled] = useState(true);
  const [pairRotationGuardEnabled, setPairRotationGuardEnabled] = useState(true);
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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    derived: false,
    synthetics_jump_boom: false,
    forex: false,
    commodities: false
  });
  const [isStrategiesExpanded, setIsStrategiesExpanded] = useState<boolean>(false);

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const fetchMartingaleData = async (forceUpdateState = false) => {
    try {
      const res = await fetch(`/api/deriv/martingale?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
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
            if (data.config.progression_mode) {
              const isPctMode = data.config.progression_mode === 'PERCENTAGE';
              setProgressionMode(isPctMode ? 'PERCENTAGE' : 'USD');
              if (isPctMode) {
                const pPrice = data.config.portfolio_price ? String(data.config.portfolio_price) : '20.00';
                const pPcts = Array.isArray(data.config.percentage_steps) && data.config.percentage_steps.length === 10 ? data.config.percentage_steps : ['1.75', '1.95', '4.15', '8.75', '18.45', '38.95', '82.25', '173.65', '365.00', '750.00'];
                handleRecalculateUsdStakes(pPrice, pPcts);
              } else if (Array.isArray(data.config.progression_steps) && data.config.progression_steps.length === 10) {
                setProgressionSteps(data.config.progression_steps.map((s: any) => String(s)));
              }
            } else if (Array.isArray(data.config.progression_steps) && data.config.progression_steps.length === 10) {
              setProgressionSteps(data.config.progression_steps.map((s: any) => String(s)));
            }
            if (Array.isArray(data.config.progression_active_steps) && data.config.progression_active_steps.length === 10) {
              setActiveSteps(data.config.progression_active_steps.map((b: any) => Boolean(b)));
            }
            if (data.config.portfolio_price) {
              setPortfolioPrice(String(data.config.portfolio_price));
            }
            if (Array.isArray(data.config.percentage_steps) && data.config.percentage_steps.length === 10) {
              setPercentageSteps(data.config.percentage_steps.map((p: any) => String(p)));
            }
            if (data.config.auto_compound_enabled !== undefined) {
              setAutoCompoundEnabled(Boolean(data.config.auto_compound_enabled));
            }
            if (data.riskFilters) {
              setNewsFilterEnabled(data.riskFilters.news !== false);
              setSessionFilterEnabled(data.riskFilters.session !== false);
              setCooldownFilterEnabled(data.riskFilters.cooldown !== false);
              setDailyLimitEnabled(data.riskFilters.daily !== false);
              setPairLossCooldownEnabled(data.riskFilters.pairLossCooldown !== false);
              setPairRotationGuardEnabled(data.riskFilters.pairRotationGuard !== false);
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

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchMartingaleData(false);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);
    }

    const dataInterval = setInterval(() => {
      fetchMartingaleData(false);
    }, 10000);

    const scanInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      handleRunInstantScan();
    }, 60000);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleVisibilityChange);
      }
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

  const handleResetAllStats = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to reset all historical Martingale stats and PnL back to $0.00?')) {
      return;
    }
    setIsSaving(true);
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
          progression_mode: progressionMode,
          portfolio_price: parseFloat(portfolioPrice) || 20.00,
          percentage_steps: percentageSteps,
          auto_compound_enabled: autoCompoundEnabled,
          reset_all_stats: true,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled,
            pairLossCooldown: pairLossCooldownEnabled,
            pairRotationGuard: pairRotationGuardEnabled
          }
        })
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: '🔄 All Martingale stats and PnL reset to $0.00!' });
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Error resetting stats:', err);
    } finally {
      setIsSaving(false);
    }
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

  const handleResetStreakToStep = async (startStepIndex = 0) => {
    setIsSaving(true);
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
          progression_mode: progressionMode,
          portfolio_price: parseFloat(portfolioPrice) || 20.00,
          percentage_steps: percentageSteps,
          auto_compound_enabled: autoCompoundEnabled,
          reset_streak: true,
          start_step_index: startStepIndex,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled,
            pairLossCooldown: pairLossCooldownEnabled,
            pairRotationGuard: pairRotationGuardEnabled
          }
        })
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: `🎯 Martingale sequence reset! Next trade will start from Step ${startStepIndex + 1}.` });
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Error resetting streak:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRiskFilter = async (filterType: string, currentValue: boolean) => {
    setIsSavingRiskToggles(true);
    const newValue = !currentValue;

    let news = newsFilterEnabled;
    let session = sessionFilterEnabled;
    let cooldown = cooldownFilterEnabled;
    let daily = dailyLimitEnabled;
    let pairLossCooldown = pairLossCooldownEnabled;
    let pairRotationGuard = pairRotationGuardEnabled;

    if (filterType === 'news') { setNewsFilterEnabled(newValue); news = newValue; }
    if (filterType === 'session') { setSessionFilterEnabled(newValue); session = newValue; }
    if (filterType === 'cooldown') { setCooldownFilterEnabled(newValue); cooldown = newValue; }
    if (filterType === 'daily') { setDailyLimitEnabled(newValue); daily = newValue; }
    if (filterType === 'pairLossCooldown') { setPairLossCooldownEnabled(newValue); pairLossCooldown = newValue; }
    if (filterType === 'pairRotationGuard') { setPairRotationGuardEnabled(newValue); pairRotationGuard = newValue; }

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
            daily,
            pairLossCooldown,
            pairRotationGuard
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

  const handleToggleAutoCompound = async () => {
    const nextState = !autoCompoundEnabled;
    setAutoCompoundEnabled(nextState);
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
          progression_mode: progressionMode,
          portfolio_price: parseFloat(portfolioPrice) || 20.00,
          percentage_steps: percentageSteps,
          auto_compound_enabled: nextState,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled,
            pairLossCooldown: pairLossCooldownEnabled,
            pairRotationGuard: pairRotationGuardEnabled
          }
        })
      });
      if (res.ok) {
        setStatusMsg({
          type: 'success',
          text: `Auto-Compound & Live Balance Distribution set to ${nextState ? 'ON (ACTIVE)' : 'OFF (PAUSED)'}!`
        });
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
        await fetchMartingaleData(true);
      }
    } catch (err) {
      console.error('Error toggling auto-compound:', err);
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
          progression_mode: progressionMode,
          portfolio_price: parseFloat(portfolioPrice) || 20.00,
          percentage_steps: percentageSteps,
          auto_compound_enabled: autoCompoundEnabled,
          riskFilters: {
            news: newsFilterEnabled,
            session: sessionFilterEnabled,
            cooldown: cooldownFilterEnabled,
            daily: dailyLimitEnabled,
            pairLossCooldown: pairLossCooldownEnabled,
            pairRotationGuard: pairRotationGuardEnabled
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
    <div className="space-y-8 max-w-7xl mx-auto pb-16 w-full max-w-full overflow-x-hidden">
      {/* Unified Command Center Ribbon */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          {/* Left: Branding & Status */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
                  Martingale Progression Engine
                </h1>
                
                {/* Engine Live Status Pill */}
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                  enabled
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                    : 'bg-zinc-900/80 text-zinc-500 border-zinc-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                  {enabled ? 'SYSTEM ACTIVE' : 'PAUSED'}
                </span>

                {/* Account Mode Pill */}
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  tradingMode === 'REAL'
                    ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                    : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                }`}>
                  {tradingMode === 'REAL' ? 'REAL LIVE' : 'DEMO VIRTUAL'}
                </span>

                {/* Execution Mode Lock Pill */}
                <span className="text-[10px] font-medium text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                  {executionMode === 'ONE_BY_ONE' ? <Lock className="w-3 h-3 text-emerald-400" /> : <Zap className="w-3 h-3 text-amber-400" />}
                  <span>{executionMode === 'ONE_BY_ONE' ? '1-by-1 Lock' : 'Concurrent'}</span>
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Isolated dynamic multi-step recovery sandbox · 1-By-1 execution guard
              </p>
            </div>
          </div>

          {/* Right: Command Actions Ribbon */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* Account Switcher Pill */}
            <div className="flex items-center bg-zinc-950/90 border border-zinc-800/90 p-1 rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => handleTradingModeChange('DEMO')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  tradingMode === 'DEMO'
                    ? 'bg-amber-500 text-zinc-950 shadow-sm font-extrabold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                DEMO
              </button>
              <button
                type="button"
                onClick={() => handleTradingModeChange('REAL')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  tradingMode === 'REAL'
                    ? 'bg-rose-500 text-white shadow-sm font-extrabold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                REAL
              </button>
            </div>

            {/* Master Engine ON/OFF Switch */}
            <button
              type="button"
              onClick={handleToggleEngine}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                enabled
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
              <span>{enabled ? 'STOP ENGINE' : 'START ENGINE'}</span>
            </button>

            {/* Reset Stats to $0.00 */}
            <button
              type="button"
              onClick={handleResetAllStats}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold py-1.5 px-3 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              title="Reset all historical Martingale stats and PnL back to $0.00"
            >
              <RefreshCw className="w-3 h-3 text-rose-400" />
              <span>Reset Stats</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMsg.text && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all shadow-md ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <XCircle className="w-4 h-4 shrink-0 text-rose-400" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Martingale Dedicated Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Deriv Wallet Balance */}
        <div className="fintech-card rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Deriv Wallet</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono ${
              tradingMode === 'REAL' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : 'bg-amber-950/60 text-amber-400 border-amber-500/30'
            }`}>
              {tradingMode === 'REAL' ? 'REAL' : 'DEMO'}
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-zinc-100 flex items-center gap-0.5">
            <span className="text-zinc-500 font-normal">$</span>
            <span>{(tradingMode === 'REAL' ? (stats.realBalance || 0) : (stats.demoBalance || 0)).toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">Total account capital</p>
        </div>

        {/* Card 2: Allocated Martingale Capital Pool */}
        <div className="fintech-card rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Active Pool</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono ${
              (stats.totalPnL || 0) >= 0 ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
            }`}>
              {(stats.totalPnL || 0) >= 0 ? '+PROFIT' : 'DRAWDOWN'}
            </span>
          </div>
          <div className={`text-lg font-bold font-mono flex items-center gap-0.5 ${(parseFloat(allocatedCapital) + (stats.totalPnL || 0)) >= parseFloat(allocatedCapital) ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span className="text-zinc-500 font-normal">$</span>
            <span>{(parseFloat(allocatedCapital) + (stats.totalPnL || 0)).toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate font-mono">
            Base: ${parseFloat(allocatedCapital).toFixed(2)}
          </p>
        </div>

        {/* Card 3: Martingale Isolated Total PnL */}
        <div className="fintech-card rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Isolated PnL</span>
            <span className="text-[9px] font-mono text-zinc-400">
              {stats?.wonCount || 0}W / {stats?.lostCount || 0}L
            </span>
          </div>
          <div className={`text-lg font-bold font-mono ${(stats?.totalPnL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(stats?.totalPnL || 0) >= 0 ? '+' : ''}${(parseFloat(String(stats?.totalPnL || 0)) || 0).toFixed(2)}
          </div>
          <p className="text-[10px] text-zinc-400 truncate font-mono">
            {stats?.wonCount || 0} Won · {stats?.lostCount || 0} Lost
          </p>
        </div>

        {/* Card 4: Execution Mode */}
        <div className="fintech-card rounded-xl p-3.5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Exec Mode</span>
            <span className="text-[9px] font-bold text-emerald-400 font-mono">LOCKED</span>
          </div>
          <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
            {executionMode === 'ONE_BY_ONE' ? <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            <span className="truncate">{executionMode === 'ONE_BY_ONE' ? 'One-By-One' : 'Concurrent'}</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">Sequential safety guard</p>
        </div>

        {/* Card 5: Martingale Win Rate */}
        <div className="fintech-card rounded-xl p-3.5 flex flex-col justify-between space-y-2 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Win Rate</span>
            <span className="text-[9px] font-mono text-zinc-400">{(stats?.totalTrades || 0)} trades</span>
          </div>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {(parseFloat(String(stats?.winRate || 0)) || 0).toFixed(1)}%
          </div>
          <p className="text-[10px] text-zinc-400 truncate">
            Across {(stats?.totalTrades || 0)} closed trades
          </p>
        </div>
      </div>

      {/* Active Safety & News Filters Card */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Active Risk &amp; Safety Guards
            </h3>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            {[newsFilterEnabled, sessionFilterEnabled, cooldownFilterEnabled, dailyLimitEnabled, pairLossCooldownEnabled, pairRotationGuardEnabled].filter(Boolean).length} / 6 Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {/* News Filter Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('news', newsFilterEnabled)}
            className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-[82px] cursor-pointer ${
              newsFilterEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-200">News Blocker</span>
              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${newsFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-500'}`}>
                {newsFilterEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 truncate">USD/EUR/GBP High Impact</p>
          </button>

          {/* Session Filter Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('session', sessionFilterEnabled)}
            className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-[82px] cursor-pointer ${
              sessionFilterEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-200">Asian Session</span>
              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${sessionFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-500'}`}>
                {sessionFilterEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 truncate">21:00 - 23:59 GMT Block</p>
          </button>

          {/* Loss Cooldown Guard Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('cooldown', cooldownFilterEnabled)}
            className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-[82px] cursor-pointer ${
              cooldownFilterEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-200">Loss Cooldown</span>
              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${cooldownFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-500'}`}>
                {cooldownFilterEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 truncate">2 Losses = 60m Rest</p>
          </button>

          {/* Daily Trades Limit Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('daily', dailyLimitEnabled)}
            className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-[82px] cursor-pointer ${
              dailyLimitEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-200">Daily Limit</span>
              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${dailyLimitEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-500'}`}>
                {dailyLimitEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 truncate">Max 10 Trades Limit</p>
          </button>

          {/* Pair Post-Loss 1-Hour Cooldown Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('pairLossCooldown', pairLossCooldownEnabled)}
            className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-[82px] cursor-pointer ${
              pairLossCooldownEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-200">Pair Pause</span>
              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${pairLossCooldownEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-500'}`}>
                {pairLossCooldownEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 truncate">1 Loss = 60m Pair Pause</p>
          </button>

          {/* Pair Rotation Guard Toggle */}
          <button
            type="button"
            onClick={() => handleToggleRiskFilter('pairRotationGuard', pairRotationGuardEnabled)}
            className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-[82px] cursor-pointer ${
              pairRotationGuardEnabled
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-200">Pair Rotate</span>
              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${pairRotationGuardEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-500'}`}>
                {pairRotationGuardEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 truncate">Switch Pair After Loss</p>
          </button>
        </div>
      </div>

      {/* Martingale Pairs Near Entry Watchlist Table Card */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/60 pb-2.5 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Near Entry Watchlist ({sortedNearEntryPairs.length} Active)
            </h3>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            {sortedNearEntryPairs.length > 0 ? `${sortedNearEntryPairs.length} pairs analyzed in current scan` : 'Scanning active pairs...'}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[280px] overflow-y-auto rounded-xl border border-zinc-800/80 bg-[#070709] scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="sticky top-0 z-10 bg-[#09090c] shadow-sm">
              <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="py-2.5 px-3">Asset Pair</th>
                <th className="py-2.5 px-2">Signal Direction</th>
                <th className="py-2.5 px-3">Proximity Status</th>
                <th className="py-2.5 px-2 text-right">Confirmations (T A S)</th>
                <th className="py-2.5 px-2 text-right">ADX</th>
                <th className="py-2.5 px-3 text-right">Stoch %K / %D</th>
                <th className="py-2.5 px-3 text-center">Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-zinc-300 font-medium text-[11px]">
              {sortedNearEntryPairs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs italic">
                    No pairs currently near entry criteria. Running automated background scans...
                  </td>
                </tr>
              ) : (
                sortedNearEntryPairs.map((pair: any, idx: number) => (
                  <tr key={idx} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-zinc-100">
                      {SYMBOL_DISPLAY_MAP[pair.symbol] || pair.symbol}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        pair.direction === 'RISE' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' :
                        pair.direction === 'FALL' ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30' :
                        'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                      }`}>
                        {pair.direction === 'RISE' ? '↗ RISE' : pair.direction === 'FALL' ? '↘ FALL' : 'ANALYZING'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 text-[10px] truncate max-w-[200px]">
                      {pair.reason}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <span
                          title="Trend Alignment"
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border ${
                            pair.confirmations?.trend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                        >
                          T
                        </span>
                        <span
                          title="ADX Momentum"
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border ${
                            pair.confirmations?.adx ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                        >
                          A
                        </span>
                        <span
                          title="Stochastic Zone"
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border ${
                            pair.confirmations?.stochZone ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                          }`}
                        >
                          S
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-zinc-200">
                      {parseFloat(pair.adx || 0).toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-400">
                      {parseFloat(pair.stochK || 50).toFixed(0)} / {parseFloat(pair.stochD || 50).toFixed(0)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <a
                        href={`https://dtrader.deriv.com/?chart_type=candle&interval=5m&symbol=${pair.symbol}&trade_type=rise_fall`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-2.5 py-0.5 text-[9px] font-bold text-amber-400 bg-amber-950/30 hover:bg-amber-900/50 border border-amber-500/30 rounded-lg transition-all uppercase tracking-wider font-mono"
                      >
                        Chart ↗
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Scanner Feed Terminal */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Live Scanner &amp; Signal Feed
            </h3>
          </div>

          <button
            type="button"
            onClick={handleRunInstantScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold py-1 px-3 rounded-lg transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Run Scan Now'}</span>
          </button>
        </div>

        <div className="bg-[#070709] border border-zinc-900 rounded-xl p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1 leading-relaxed text-zinc-300">
          {scanLogs.length === 0 ? (
            <div className="text-zinc-600 text-center py-4">
              No recent scan logs. Click "Run Scan Now" or wait for automated scan cycle.
            </div>
          ) : (
            scanLogs.map((logLine, idx) => {
              const isTrade = logLine.includes('TRADE EXECUTED') || logLine.includes('WON') || logLine.includes('PLACED');
              const isReject = logLine.includes('REJECTED') || logLine.includes('SKIP') || logLine.includes('BLOCKED');
              const isInfo = logLine.includes('SCAN');

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-1.5 ${
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
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Capital Pool &amp; Execution Controls
            </h3>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3.5 rounded-xl shadow-md transition-all shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Allocated Capital Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <span>Martingale Capital Allocation Pool</span>
              <span title="Amount in USD dedicated solely for Martingale execution"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="5.00"
                value={allocatedCapital}
                onChange={(e) => setAllocatedCapital(e.target.value)}
                className="w-full bg-[#070709] border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-2 px-3 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none text-xs"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-[11px] font-bold text-zinc-500">
                USD
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-zinc-500 gap-1 pt-0.5">
              <span>Dedicated pool. Main strategy testing funds remain untouched.</span>
              <span className="font-mono font-bold text-zinc-400 shrink-0">
                Wallet ({tradingMode}): ${(tradingMode === 'REAL' ? (stats.realBalance || 0) : (stats.demoBalance || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Execution Mode Radio Cards */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <span>Trade Execution Mode</span>
              <span title="Controls single trade sequential locking vs multi-trade entries"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <div
                onClick={() => handleExecutionModeChange('ONE_BY_ONE')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  executionMode === 'ONE_BY_ONE'
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-[#070709] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> One-By-One
                  </span>
                  <CheckSquare className={`w-3.5 h-3.5 ${executionMode === 'ONE_BY_ONE' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                </div>
                <p className="text-[9px] text-zinc-500 leading-tight">
                  Single sequential trade lock. Waits for expiry.
                </p>
              </div>

              <div
                onClick={() => handleExecutionModeChange('ALL_CONCURRENT')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  executionMode === 'ALL_CONCURRENT'
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-[#070709] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> All Concurrent
                  </span>
                  <CheckSquare className={`w-3.5 h-3.5 ${executionMode === 'ALL_CONCURRENT' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                </div>
                <p className="text-[9px] text-zinc-500 leading-tight">
                  Allows multiple concurrent trades across pairs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control 2: Custom 10-Step Progression & Recovery Table */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-zinc-800/60 pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider">
                10-Step Progression &amp; Recovery Table
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Loss moves to next active step. ANY winning trade resets back to Step 1.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Start Next Trade From Step Selector */}
            <div className="flex items-center bg-zinc-950/80 border border-amber-500/40 rounded-xl px-2.5 py-1 gap-1.5">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Start From:
              </span>
              <select
                value={stats.currentStepIndex ?? 0}
                onChange={(e) => handleResetStreakToStep(parseInt(e.target.value, 10))}
                className="bg-[#070709] border border-amber-500/40 text-amber-300 text-xs font-bold rounded-lg px-2 py-0.5 focus:outline-none cursor-pointer"
              >
                {progressionSteps.map((_, i) => (
                  <option key={i} value={i} disabled={activeSteps[i] === false}>
                    Step {i + 1} (${progressionSteps[i]})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Force Reset to Step 1 Button */}
            <button
              type="button"
              onClick={() => handleResetStreakToStep(0)}
              disabled={isSaving}
              className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold py-1.5 px-3 rounded-xl transition-all shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-amber-400" />
              <span>Reset to Step 1</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3.5 rounded-xl shadow-md transition-all shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Steps'}</span>
            </button>
          </div>
        </div>

        {/* Mode Toggle Switch & Total Portfolio Input Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-400">Mode:</span>
            <div className="flex items-center bg-[#070709] border border-zinc-800 rounded-lg p-0.5 gap-1">
              <button
                type="button"
                onClick={() => setProgressionMode('USD')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  progressionMode === 'USD'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                USD Fixed ($)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProgressionMode('PERCENTAGE');
                  handleRecalculateUsdStakes(portfolioPrice, percentageSteps);
                }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  progressionMode === 'PERCENTAGE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Percentage (%)
              </button>
            </div>
          </div>

          {progressionMode === 'PERCENTAGE' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-[11px] font-bold text-amber-400 shrink-0">Portfolio Capital:</label>
              <div className="relative flex-1 sm:w-28">
                <input
                  type="number"
                  step="1"
                  min="5"
                  value={portfolioPrice}
                  onChange={(e) => {
                    const newPrice = e.target.value;
                    setPortfolioPrice(newPrice);
                    handleRecalculateUsdStakes(newPrice, percentageSteps);
                  }}
                  className="w-full bg-[#070709] border border-amber-500/60 rounded-lg py-1 pl-2.5 pr-8 font-mono text-xs font-bold text-amber-300 focus:outline-none"
                  placeholder="20.00"
                />
                <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-[10px] font-bold text-amber-400">
                  USD
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Auto-Compound Balance Distribution Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleAutoCompound}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoCompoundEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  autoCompoundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <RefreshCw className={`w-3 h-3 ${autoCompoundEnabled ? 'animate-spin' : ''}`} />
                  Auto-Compound &amp; Live Balance Distribution
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  autoCompoundEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {autoCompoundEnabled ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Automatically circulates profits after wins: scales up step stakes in real-time as pool grows.
              </p>
            </div>
          </div>

          {autoCompoundEnabled && (
            <div className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-xs font-mono shrink-0">
              <span className="text-zinc-300">Live Pool:</span>
              <b className="text-emerald-300 font-bold">
                ${((parseFloat(String(progressionMode === 'PERCENTAGE' ? portfolioPrice : allocatedCapital)) || 20) + (parseFloat(String(stats?.totalPnL)) || 0)).toFixed(2)}
              </b>
            </div>
          )}
        </div>

        {/* 10 Step Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {(() => {
            const activeBaseSum = progressionSteps.reduce((acc, sVal, i) => {
              return activeSteps[i] !== false ? acc + (parseFloat(sVal) || 0.35) : acc;
            }, 0);

            return progressionSteps.map((stepVal, idx) => {
              const isChecked = activeSteps[idx] !== false;
              const isActiveStep = idx === (stats.currentStepIndex ?? 0);

              // Compute Real-time Live Scaled Stake based on Allocated Capital Pool & Auto-Compound Live Pool Distribution
              const baseCap = parseFloat(String(progressionMode === 'PERCENTAGE' ? portfolioPrice : allocatedCapital)) || 20.00;
              const allocatedPoolWithPnL = Math.max(0.35, baseCap + (parseFloat(String(stats?.totalPnL)) || 0));
              const livePool = autoCompoundEnabled
                ? allocatedPoolWithPnL
                : baseCap;

              let stepBaseUsd = parseFloat(stepVal) || 0.35;
              if (progressionMode === 'PERCENTAGE') {
                const pct = parseFloat(percentageSteps[idx]) || 0;
                stepBaseUsd = Math.max(0.35, Math.round(((baseCap * pct) / 100) * 100) / 100);
              }

              let liveScaledStakeNum = stepBaseUsd;
              if (autoCompoundEnabled && activeBaseSum > 0 && isChecked) {
                // Find if this is the last active checked step
                const activeIndices: number[] = [];
                activeSteps.forEach((act, i) => { if (act !== false) activeIndices.push(i); });
                const isLastActive = activeIndices.length > 1 && activeIndices[activeIndices.length - 1] === idx;

                if (isLastActive) {
                  let precSum = 0;
                  for (let i = 0; i < activeIndices.length - 1; i++) {
                    const actIdx = activeIndices[i];
                    let sBase = parseFloat(progressionSteps[actIdx]) || 0.35;
                    if (progressionMode === 'PERCENTAGE') {
                      const p = parseFloat(percentageSteps[actIdx]) || 0;
                      sBase = Math.max(0.35, Math.round(((baseCap * p) / 100) * 100) / 100);
                    }
                    precSum += Math.max(0.35, Math.round((livePool * (sBase / activeBaseSum)) * 100) / 100);
                  }
                  liveScaledStakeNum = Math.max(0.35, Math.round((livePool - precSum) * 100) / 100);
                } else {
                  const stepRatio = stepBaseUsd / activeBaseSum;
                  liveScaledStakeNum = Math.max(0.35, Math.round((livePool * stepRatio) * 100) / 100);
                }
              }
              const liveScaledStake = liveScaledStakeNum.toFixed(2);

              // Compute Cumulative Required Balance up to current step
              let cumulativeNeeded = 0;
              for (let i = 0; i <= idx; i++) {
                if (activeSteps[i] !== false) {
                  let sUsd = parseFloat(progressionSteps[i]) || 0.35;
                  if (progressionMode === 'PERCENTAGE') {
                    const p = parseFloat(percentageSteps[i]) || 0;
                    sUsd = Math.max(0.35, Math.round(((baseCap * p) / 100) * 100) / 100);
                  }
                  let sScaled = sUsd;
                  if (autoCompoundEnabled && activeBaseSum > 0) {
                    sScaled = Math.max(0.35, Math.round((livePool * (sUsd / activeBaseSum)) * 100) / 100);
                  }
                  cumulativeNeeded += sScaled;
                }
              }

              const isInsufficient = isChecked && ((livePool + 0.05) < cumulativeNeeded);

            return (
              <div
                key={idx}
                className={`fintech-card rounded-xl p-3 flex flex-col justify-between space-y-2 relative transition-all ${
                  isActiveStep
                    ? 'border-amber-400/90 ring-1 ring-amber-400/50 bg-amber-950/20 shadow-lg shadow-amber-950/40 text-amber-100'
                    : isInsufficient
                    ? 'border-rose-500/80 ring-1 ring-rose-500/40 bg-rose-950/20 text-rose-100'
                    : isChecked
                    ? 'border-zinc-800 hover:border-zinc-700 text-zinc-100'
                    : 'border-zinc-900 bg-zinc-950/40 opacity-50 text-zinc-500'
                }`}
              >
                {/* Step Header */}
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
                    <span className={`text-[11px] font-bold font-mono uppercase ${
                      isActiveStep ? 'text-amber-300' : isInsufficient ? 'text-rose-400' : isChecked ? 'text-zinc-200' : 'text-zinc-500'
                    }`}>
                      Step {idx + 1}
                    </span>
                  </label>

                  {isActiveStep ? (
                    <span className="text-[8px] font-black bg-amber-400 text-zinc-950 px-1.5 py-0.5 rounded tracking-wider shadow-sm">
                      ⚡ NEXT
                    </span>
                  ) : isInsufficient ? (
                    <span className="text-[8px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded tracking-wider shadow-sm">
                      ⚠️ SHORT
                    </span>
                  ) : idx === 0 ? (
                    <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                      RESET
                    </span>
                  ) : null}
                </div>

                {/* Input Field */}
                {progressionMode === 'PERCENTAGE' ? (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        disabled={!isChecked}
                        value={percentageSteps[idx] || '0'}
                        onChange={(e) => {
                          const newPcts = [...percentageSteps];
                          newPcts[idx] = e.target.value;
                          setPercentageSteps(newPcts);
                          handleRecalculateUsdStakes(portfolioPrice, newPcts);
                        }}
                        className={`w-full bg-[#070709] border rounded-lg py-1.5 px-2.5 font-mono text-xs focus:outline-none transition-all ${
                          isActiveStep
                            ? 'border-amber-500/80 text-amber-200 font-bold'
                            : isInsufficient
                            ? 'border-rose-500/80 text-rose-200 font-bold'
                            : isChecked
                            ? 'border-zinc-800 text-zinc-100'
                            : 'border-zinc-900 text-zinc-600 cursor-not-allowed'
                        }`}
                      />
                      <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-[10px] font-bold text-emerald-400">
                        %
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.35"
                        disabled={!isChecked}
                        value={autoCompoundEnabled ? liveScaledStake : stepVal}
                        onChange={(e) => {
                          const newSteps = [...progressionSteps];
                          newSteps[idx] = e.target.value;
                          setProgressionSteps(newSteps);
                        }}
                        className={`w-full bg-[#070709] border rounded-lg py-1.5 px-2.5 font-mono text-xs focus:outline-none transition-all ${
                          isActiveStep
                            ? 'border-amber-500/80 text-amber-200 font-bold'
                            : isInsufficient
                            ? 'border-rose-500/80 text-rose-200 font-bold'
                            : isChecked
                            ? 'border-zinc-800 text-zinc-100 font-bold'
                            : 'border-zinc-900 text-zinc-600 cursor-not-allowed'
                        }`}
                      />
                      <span className={`absolute inset-y-0 right-0 pr-2 flex items-center text-[10px] font-bold ${
                        isActiveStep ? 'text-amber-400' : isInsufficient ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        $
                      </span>
                    </div>
                  </div>
                )}

                {/* Single-line Micro Status Pill */}
                {autoCompoundEnabled && isChecked && (
                  <div className={`text-[9px] font-mono flex items-center justify-between px-2 py-1 rounded-md border ${
                    isInsufficient ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400'
                  }`}>
                    <span>Base: ${stepBaseUsd.toFixed(2)}</span>
                    <span className={isInsufficient ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                      Left: ${Math.max(0, livePool - cumulativeNeeded).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            );
          });
        })()}
        </div>

        {/* Progression Table Active Steps Summary Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-zinc-800/60 pt-3 gap-2">
          <span className="text-[11px] text-zinc-400 font-mono">
            Active Steps: <b className="text-emerald-400">{activeSteps.filter(Boolean).length} / 10</b>
          </span>
          <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 bg-amber-950/30 border border-amber-500/30 px-3 py-1 rounded-xl">
            <span>⚡ Next Execution Stake:</span>
            {(() => {
              const currentIdx = stats.currentStepIndex ?? 0;
              const baseCap = parseFloat(String(progressionMode === 'PERCENTAGE' ? portfolioPrice : allocatedCapital)) || 20.00;
              const allocatedPoolWithPnL = Math.max(0.35, baseCap + (parseFloat(String(stats?.totalPnL)) || 0));
              const livePool = autoCompoundEnabled ? allocatedPoolWithPnL : baseCap;

              const activeBaseSum = progressionSteps.reduce((acc, sVal, i) => {
                return activeSteps[i] !== false ? acc + (parseFloat(sVal) || 0.35) : acc;
              }, 0);

              let currentStepBaseUsd = parseFloat(progressionSteps[currentIdx]) || 0.35;
              if (progressionMode === 'PERCENTAGE') {
                const pct = parseFloat(percentageSteps[currentIdx]) || 0;
                currentStepBaseUsd = Math.max(0.35, Math.round(((baseCap * pct) / 100) * 100) / 100);
              }
              let nextExecStake = currentStepBaseUsd;
              if (autoCompoundEnabled && activeBaseSum > 0) {
                const stepRatio = currentStepBaseUsd / activeBaseSum;
                nextExecStake = Math.max(0.35, Math.round((livePool * stepRatio) * 100) / 100);
              }

              return (
                <b className="text-amber-300 font-bold">
                  Step {currentIdx + 1} (${nextExecStake.toFixed(2)} USD)
                </b>
              );
            })()}
          </span>
        </div>
      </div>

      {/* Control 3: Dedicated Martingale Active Strategy Engines */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
          <div
            onClick={() => setIsStrategiesExpanded(!isStrategiesExpanded)}
            className="flex-1 flex flex-wrap items-center gap-2 cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider hover:text-emerald-400 transition-colors">
              Dedicated Strategy Engines ({selectedStrategies.length} / 4 Active)
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={selectAllStrategies}
              className="text-[10px] sm:text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer hidden sm:inline-block"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAllStrategies}
              className="text-[10px] sm:text-xs bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer hidden sm:inline-block"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-extrabold px-3.5 py-1.5 rounded-xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Strategy'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStrategiesExpanded(!isStrategiesExpanded)}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 px-3 py-1 rounded-xl transition-all cursor-pointer"
            >
              <span>{isStrategiesExpanded ? 'Hide' : 'Expand'}</span>
              {isStrategiesExpanded ? (
                <ChevronUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          </div>
        </div>

        {isStrategiesExpanded && (
          <div className="pt-3 border-t border-zinc-800/50 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Tick whichever strategy engines you want to run for Martingale trade execution. You can tick one, multiple, or all 4 strategies.
              </p>
              <div className="flex items-center gap-1.5 sm:hidden shrink-0">
                <button
                  type="button"
                  onClick={selectAllStrategies}
                  className="text-[10px] bg-zinc-800 text-zinc-200 font-bold px-2 py-0.5 rounded-md"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={clearAllStrategies}
                  className="text-[10px] bg-zinc-900 text-zinc-500 font-bold px-2 py-0.5 rounded-md"
                >
                  Clear
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
        )}
      </div>

      {/* Control 4: Dedicated Martingale Pair Selector (5 Market Categories) */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/60 pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider">
                Dedicated Scanned Pairs ({selectedPairs.length} Active Across 5 Categories)
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Select pairs for Martingale execution across 5 market categories.
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

        {/* 5 Categorized Market Containers (Collapsible Mobile-Friendly Accordion Menu) */}
        <div className="space-y-3">
          {MARKET_CATEGORIES.map((cat) => {
            const activeInCatCount = cat.pairs.filter(p => selectedPairs.includes(p)).length;
            const isExpanded = expandedCategories[cat.id] ?? false;

            return (
              <div
                key={cat.id}
                className="bg-[#08080b]/90 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-4 transition-all shadow-md"
              >
                {/* Accordion Header Bar */}
                <div className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => toggleCategoryExpand(cat.id)}
                    className="flex-1 flex flex-wrap items-center gap-2.5"
                  >
                    <span className="text-xs font-extrabold text-zinc-100 uppercase tracking-wider hover:text-emerald-400 transition-colors">
                      {cat.name}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                      activeInCatCount > 0
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                    }`}>
                      {activeInCatCount} / {cat.pairs.length} Active
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCategoryPairs(cat.pairs);
                      }}
                      className="text-[10px] bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer hidden sm:inline-block"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearCategoryPairs(cat.pairs);
                      }}
                      className="text-[10px] bg-zinc-900 hover:bg-zinc-850 text-zinc-500 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer hidden sm:inline-block"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCategoryExpand(cat.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 px-3 py-1 rounded-xl transition-all cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide' : 'Expand'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="pt-3 border-t border-zinc-800/60 mt-3 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-zinc-400 italic">{cat.desc}</p>
                      <div className="flex items-center gap-1.5 sm:hidden">
                        <button
                          type="button"
                          onClick={() => selectCategoryPairs(cat.pairs)}
                          className="text-[10px] bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-bold px-2 py-0.5 rounded-md"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => clearCategoryPairs(cat.pairs)}
                          className="text-[10px] bg-zinc-900 text-zinc-500 font-bold px-2 py-0.5 rounded-md"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Category Pair Grid with vertical scrollbar */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
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
                )}
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
        <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-3.5 border-emerald-500/30 shadow-lg">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>Active Martingale Positions ({openTrades.length})</span>
            </h3>
            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg uppercase tracking-wider animate-pulse">
              1-By-1 Lock Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {openTrades.map((t) => (
              <div key={t.id} className="bg-[#070709] border border-emerald-500/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-100">{SYMBOL_DISPLAY_MAP[t.symbol] || t.symbol}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${t.contract_type === 'CALL' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-400 border border-rose-500/30'}`}>
                    {t.contract_type === 'CALL' ? '↗ RISE' : '↘ FALL'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-0.5">
                  <span className="text-zinc-400">Stake:</span>
                  <span className="font-bold text-emerald-400">${(parseFloat(t.stake) || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Entry Spot:</span>
                  <span className="font-mono text-zinc-300">{t.entry_price ? parseFloat(t.entry_price).toFixed(4) : 'N/A'}</span>
                </div>
                <div className="text-[9px] text-zinc-500 font-mono text-right pt-0.5">
                  Opened: {new Date(t.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
                <a
                  href={`https://dtrader.deriv.com/?chart_type=candle&interval=5m&symbol=${t.symbol}&trade_type=rise_fall`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-center gap-1.5 w-full py-1 px-2.5 text-[10px] font-bold text-amber-400 bg-amber-950/30 hover:bg-amber-900/50 border border-amber-500/30 rounded-lg transition-all uppercase tracking-wider font-mono shadow-sm cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3 text-amber-400" />
                  <span>View Live Chart ↗</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dedicated Martingale Trades History Table */}
      <div className="fintech-card rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/60 pb-3 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider">
                Dedicated Martingale Trades History
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Closed trades executed exclusively by the Martingale progression engine.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-950/80 border border-zinc-800/80 p-0.5 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setTradeFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${tradeFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              All ({recentTrades.length})
            </button>
            <button
              type="button"
              onClick={() => setTradeFilter('won')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${tradeFilter === 'won' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Won ({recentTrades.filter(t => t.status === 'WON').length})
            </button>
            <button
              type="button"
              onClick={() => setTradeFilter('lost')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${tradeFilter === 'lost' ? 'bg-rose-950 text-rose-400 border border-rose-500/30' : 'text-zinc-400 hover:text-zinc-200'}`}
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
              <div className="text-center py-8 text-zinc-500 text-xs">
                No Martingale trades found for the selected filter.
              </div>
            );
          }

          return (
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-xl border border-zinc-800/80 bg-[#070709] scrollbar-thin">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="sticky top-0 z-10 bg-[#09090c] shadow-sm">
                  <tr className="border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-3">Asset</th>
                    <th className="py-2.5 px-2">Direction</th>
                    <th className="py-2.5 px-2">Entry Spot</th>
                    <th className="py-2.5 px-2">Exit Spot</th>
                    <th className="py-2.5 px-2">Stake</th>
                    <th className="py-2.5 px-2">Net Return</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-3 text-right">Close Time (Jeddah)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300 font-medium text-[11px]">
                  {filtered.map((t) => {
                    const pnlVal = parseFloat(t.pnl) || 0;
                    const isWon = t.status === 'WON' || pnlVal > 0;
                    const isLost = t.status === 'LOST' || pnlVal < 0;
                    return (
                      <tr key={t.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-zinc-100">{SYMBOL_DISPLAY_MAP[t.symbol] || t.symbol}</td>
                        <td className="py-2.5 px-2 font-bold">
                          <span className={t.contract_type === 'CALL' ? 'text-emerald-400' : 'text-rose-400'}>
                            {t.contract_type === 'CALL' ? 'RISE' : 'FALL'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-zinc-400">{t.entry_price ? parseFloat(t.entry_price).toFixed(4) : 'N/A'}</td>
                        <td className="py-2.5 px-2 text-zinc-400">{t.exit_price ? parseFloat(t.exit_price).toFixed(4) : 'N/A'}</td>
                        <td className="py-2.5 px-2 font-bold text-zinc-200">${(parseFloat(t.stake) || 0).toFixed(2)}</td>
                        <td className={`py-2.5 px-2 font-bold ${pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isWon ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' :
                            isLost ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30' :
                            'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[10px] text-right font-mono">
                          {t.closed_at ? new Date(t.closed_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date(t.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: true })}
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
