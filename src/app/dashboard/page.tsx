'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Layers,
  Settings,
  RefreshCw,
  Loader2,
  Save,
  CheckCircle,
  AlertTriangle,
  Play,
  Eye,
  EyeOff,
  FlaskConical,
  ShieldAlert,
  Square
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DerivTrade {
  id: string;
  contract_id: number;
  symbol: string;
  contract_type: 'CALL' | 'PUT';
  duration: number;
  duration_unit: string;
  stake: number;
  payout: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'ERROR';
  entry_price: number;
  exit_price: number | null;
  pnl: number;
  is_paper: boolean;
  created_at: string;
  closed_at: string | null;
}

const STRATEGIES_LIST = [
  { id: 'FOREX_15M_PRO_V1', name: 'v1 - Forex 15m Trend-Rejection Pro', desc: 'v1 Pro: 1H/15m Trend Tide + 5m EMA 20/50 Pullback + Wick Rejection & Color Confirmation + 15m Expiry.' },
  { id: 'FOREX_15M_MTF', name: 'v1 - Forex 15m MTF Crossover', desc: 'H1 Trend Filter + 15m EMA/ADX + 5m Stochastic crossover entry trigger.' },
  { id: 'FOREX_15M_MTF_V2', name: 'v2 - Forex 15m MTF Crossover', desc: 'v2: Adds Support/Resistance and Candlestick Filter validations for higher accuracy.' },
  { id: 'FOREX_30M_MTF_V3', name: 'v1.1 - Forex 30m MTF Crossover', desc: 'v1.1: Triple Trend (H4/H1/30m) + ATR Volatility Filter + RSI Guard + 30m contracts.' }
];

// 1. Derived Markets (Synthetics, Step, Jump, Volatilities, Daily Reset) - Rise/Fall Supported
const DERIVED_PAIRS_LIST = [
  // Step Indices
  { id: 'stpRNG', name: 'Step 100 Index', desc: 'Step sizing 0.1 average' },
  { id: 'stpRNG2', name: 'Step 200 Index', desc: 'Step average sizing 0.2' },
  { id: 'stpRNG3', name: 'Step 300 Index', desc: 'Step average sizing 0.3' },
  { id: 'stpRNG4', name: 'Step 400 Index', desc: 'Step average sizing 0.4' },
  { id: 'stpRNG5', name: 'Step 500 Index', desc: 'Step average sizing 0.5' },
  // Volatility Indices
  { id: 'R_10', name: 'Volatility 10 Index', desc: 'Constant volatility 10%' },
  { id: 'R_25', name: 'Volatility 25 Index', desc: 'Constant volatility 25%' },
  { id: 'R_50', name: 'Volatility 50 Index', desc: 'Constant volatility 50%' },
  { id: 'R_75', name: 'Volatility 75 Index', desc: 'Constant volatility 75%' },
  { id: 'R_100', name: 'Volatility 100 Index', desc: 'Constant volatility 100%' },
  { id: '1HZ10V', name: 'Volatility 10 (1s) Index', desc: 'Volatility 10% (1-sec tick)' },
  { id: '1HZ15V', name: 'Volatility 15 (1s) Index', desc: 'Volatility 15% (1-sec tick)' },
  { id: '1HZ25V', name: 'Volatility 25 (1s) Index', desc: 'Volatility 25% (1-sec tick)' },
  { id: '1HZ30V', name: 'Volatility 30 (1s) Index', desc: 'Volatility 30% (1-sec tick)' },
  { id: '1HZ50V', name: 'Volatility 50 (1s) Index', desc: 'Volatility 50% (1-sec tick)' },
  { id: '1HZ75V', name: 'Volatility 75 (1s) Index', desc: 'Volatility 75% (1-sec tick)' },
  { id: '1HZ90V', name: 'Volatility 90 (1s) Index', desc: 'Volatility 90% (1-sec tick)' },
  { id: '1HZ100V', name: 'Volatility 100 (1s) Index', desc: 'Volatility 100% (1-sec tick)' },
  // Jump Indices
  { id: 'JD10', name: 'Jump 10 Index', desc: 'Jump volatility 10%' },
  { id: 'JD25', name: 'Jump 25 Index', desc: 'Jump volatility 25%' },
  { id: 'JD50', name: 'Jump 50 Index', desc: 'Jump volatility 50%' },
  { id: 'JD75', name: 'Jump 75 Index', desc: 'Jump volatility 75%' },
  { id: 'JD100', name: 'Jump 100 Index', desc: 'Jump volatility 100%' },
  // Daily Reset Indices
  { id: 'RDBULL', name: 'Bull Market Index', desc: 'Constant bull trend' },
  { id: 'RDBEAR', name: 'Bear Market Index', desc: 'Constant bear trend' }
];

// 2. Forex Markets (Major pairs, Minor pairs, Currency Baskets) - Rise/Fall Supported
const FOREX_PAIRS_LIST = [
  // Major Pairs
  { id: 'frxEURUSD', name: 'EUR/USD', desc: 'Euro / US Dollar' },
  { id: 'frxGBPUSD', name: 'GBP/USD', desc: 'Great British Pound / US Dollar' },
  { id: 'frxUSDJPY', name: 'USD/JPY', desc: 'US Dollar / Japanese Yen' },
  { id: 'frxAUDUSD', name: 'AUD/USD', desc: 'Australian Dollar / US Dollar' },
  { id: 'frxUSDCAD', name: 'USD/CAD', desc: 'US Dollar / Canadian Dollar' },
  { id: 'frxUSDCHF', name: 'USD/CHF', desc: 'US Dollar / Swiss Franc' },
  { id: 'frxAUDJPY', name: 'AUD/JPY', desc: 'Australian Dollar / Japanese Yen' },
  { id: 'frxEURJPY', name: 'EUR/JPY', desc: 'Euro / Japanese Yen' },
  { id: 'frxGBPJPY', name: 'GBP/JPY', desc: 'Great British Pound / Japanese Yen' },
  { id: 'frxEURAUD', name: 'EUR/AUD', desc: 'Euro / Australian Dollar' },
  { id: 'frxEURCAD', name: 'EUR/CAD', desc: 'Euro / Canadian Dollar' },
  { id: 'frxEURCHF', name: 'EUR/CHF', desc: 'Euro / Swiss Franc' },
  { id: 'frxEURGBP', name: 'EUR/GBP', desc: 'Euro / Great British Pound' },
  { id: 'frxGBPAUD', name: 'GBP/AUD', desc: 'Great British Pound / Australian Dollar' },
  // Minor & Exotic Pairs
  { id: 'frxAUDCAD', name: 'AUD/CAD', desc: 'Australian Dollar / Canadian Dollar' },
  { id: 'frxAUDCHF', name: 'AUD/CHF', desc: 'Australian Dollar / Swiss Franc' },
  { id: 'frxAUDNZD', name: 'AUD/NZD', desc: 'Australian Dollar / New Zealand Dollar' },
  { id: 'frxEURNZD', name: 'EUR/NZD', desc: 'Euro / New Zealand Dollar' },
  { id: 'frxGBPCAD', name: 'GBP/CAD', desc: 'Great British Pound / Canadian Dollar' },
  { id: 'frxGBPCHF', name: 'GBP/CHF', desc: 'Great British Pound / Swiss Franc' },
  { id: 'frxGBPNZD', name: 'GBP/NZD', desc: 'Great British Pound / New Zealand Dollar' },
  { id: 'frxNZDJPY', name: 'NZD/JPY', desc: 'New Zealand Dollar / Japanese Yen' },
  { id: 'frxNZDUSD', name: 'NZD/USD', desc: 'New Zealand Dollar / US Dollar' },
  { id: 'frxUSDMXN', name: 'USD/MXN', desc: 'USD / Mexican Peso' },
  { id: 'frxUSDPLN', name: 'USD/PLN', desc: 'USD / Polish Zloty' },
  // Forex Baskets
  { id: 'WLDAUD', name: 'AUD Basket', desc: 'AUD Currency Basket' },
  { id: 'WLDEUR', name: 'EUR Basket', desc: 'EUR Currency Basket' },
  { id: 'WLDGBP', name: 'GBP Basket', desc: 'GBP Currency Basket' },
  { id: 'WLDUSD', name: 'USD Basket', desc: 'USD Currency Basket' }
];

// 3. Stocks & Indices (American, Asian, European) - Rise/Fall Supported
const STOCKS_INDICES_PAIRS_LIST = [
  // American Indices
  { id: 'OTC_SPC', name: 'US 500', desc: 'US 500 OTC' },
  { id: 'OTC_DJI', name: 'Wall Street 30', desc: 'Wall Street 30 OTC' },
  { id: 'OTC_NDX', name: 'US Tech 100', desc: 'US Tech 100 OTC' },
  // Asian Indices
  { id: 'OTC_N225', name: 'Japan 225', desc: 'Japan 225 OTC' },
  { id: 'OTC_HSI', name: 'Hong Kong 50', desc: 'Hong Kong 50 OTC' },
  { id: 'OTC_AS51', name: 'Australia 200', desc: 'Australia 200 OTC' },
  // European Indices
  { id: 'OTC_AEX', name: 'Netherlands 25', desc: 'Netherlands 25 OTC' },
  { id: 'OTC_SX5E', name: 'Euro 50', desc: 'Euro 50 OTC' },
  { id: 'OTC_GDAXI', name: 'Germany 40', desc: 'Germany 40 OTC' },
  { id: 'OTC_SSMI', name: 'Swiss 20', desc: 'Swiss 20 OTC' },
  { id: 'OTC_FCHI', name: 'France 40', desc: 'France 40 OTC' },
  { id: 'OTC_FTSE', name: 'UK 100', desc: 'UK 100 OTC' }
];

// 4. Commodities & Metals - Rise/Fall Supported
const COMMODITIES_PAIRS_LIST = [
  { id: 'frxXAUUSD', name: 'Gold / USD', desc: 'Spot Gold' },
  { id: 'frxXAGUSD', name: 'Silver / USD', desc: 'Spot Silver' },
  { id: 'frxXPTUSD', name: 'Platinum / USD', desc: 'Spot Platinum' },
  { id: 'frxXPDUSD', name: 'Palladium / USD', desc: 'Spot Palladium' },
  { id: 'WLDXAU', name: 'Gold Basket', desc: 'Gold Commodity Basket' }
];

export default function DerivDashboard() {
  // Credentials
  const [appId, setAppId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [demoAccount, setDemoAccount] = useState('');
  const [realAccount, setRealAccount] = useState('');
  const [demoBalance, setDemoBalance] = useState(0.00);
  const [realBalance, setRealBalance] = useState(0.00);
  const [tradingMode, setTradingMode] = useState<'DEMO' | 'REAL'>('DEMO');
  
  // Toggles & logs
  const [derivBotEnabled, setDerivBotEnabled] = useState(false);
  const [lastScanAt, setLastScanAt] = useState('');
  const [lastScanLogs, setLastScanLogs] = useState<string[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' });
  const [showToken, setShowToken] = useState(false);

  // Bot control panel state states
  const [dashboardMaxTrades, setDashboardMaxTrades] = useState('10');
  const [isSavingMaxTrades, setIsSavingMaxTrades] = useState(false);
  const [isTestingProject, setIsTestingProject] = useState(false);
  const [isTestingTrade, setIsTestingTrade] = useState(false);
  const [isClosingAll, setIsClosingAll] = useState(false);
  const [selectedChartSymbol, setSelectedChartSymbol] = useState('frxEURUSD');
  const [isTogglingBot, setIsTogglingBot] = useState(false);
  const [dashboardStakeAmount, setDashboardStakeAmount] = useState('1.00');
  const [isSavingStake, setIsSavingStake] = useState(false);
  const [nearEntryPairs, setNearEntryPairs] = useState<any[]>([]);
  const [isForceScanning, setIsForceScanning] = useState(false);

  // Sort nearEntryPairs descending by number of active confirmations (T A S) and then by ADX value
  const sortedNearEntryPairs = useMemo(() => {
    if (!nearEntryPairs) return [];
    return [...nearEntryPairs].sort((a, b) => {
      const scoreA = (a.confirmations?.trend ? 1 : 0) + (a.confirmations?.adx ? 1 : 0) + (a.confirmations?.stochZone ? 1 : 0);
      const scoreB = (b.confirmations?.trend ? 1 : 0) + (b.confirmations?.adx ? 1 : 0) + (b.confirmations?.stochZone ? 1 : 0);
      
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      return parseFloat(b.adx || 0) - parseFloat(a.adx || 0);
    });
  }, [nearEntryPairs]);

  // Selected pairs list state
  const [selectedPairs, setSelectedPairs] = useState<string[]>(['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY']);
  const [draftPairs, setDraftPairs] = useState<string[]>(['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY']);

  // Risk filter toggles states
  const [newsFilterEnabled, setNewsFilterEnabled] = useState(true);
  const [sessionFilterEnabled, setSessionFilterEnabled] = useState(true);
  const [cooldownFilterEnabled, setCooldownFilterEnabled] = useState(true);
  const [dailyLimitEnabled, setDailyLimitEnabled] = useState(true);
  const [isSavingRiskToggles, setIsSavingRiskToggles] = useState(false);

  const getPairDisplayName = (symbolId: string) => {
    const allPairs = [...DERIVED_PAIRS_LIST, ...FOREX_PAIRS_LIST, ...STOCKS_INDICES_PAIRS_LIST, ...COMMODITIES_PAIRS_LIST];
    const match = allPairs.find(p => p.id === symbolId);
    return match ? match.name : symbolId.replace('frx', '').replace('cry', '').replace('OTC_', '');
  };

  // Strategy list selectors
  const [activeStrategies, setActiveStrategies] = useState<string[]>(['FOREX_15M_MTF']);
  const [draftStrategies, setDraftStrategies] = useState<string[]>(['FOREX_15M_MTF']);
  const [isSavingStrategies, setIsSavingStrategies] = useState(false);
  const [searchEnginesQuery, setSearchEnginesQuery] = useState('');

  // 4 Verified Rise/Fall Market Categories states
  const [activeMarketTab, setActiveMarketTab] = useState<'derived' | 'forex' | 'stocks' | 'commodities'>('derived');
  const [searchDerivedQuery, setSearchDerivedQuery] = useState('');
  const [searchForexQuery, setSearchForexQuery] = useState('');
  const [searchStocksQuery, setSearchStocksQuery] = useState('');
  const [searchCommoditiesQuery, setSearchCommoditiesQuery] = useState('');

  // Trades states
  const [trades, setTrades] = useState<DerivTrade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Manual trade form state
  const [tradeSymbol, setTradeSymbol] = useState('frxEURUSD');
  const [tradeType, setTradeType] = useState<'CALL' | 'PUT'>('CALL');
  const [tradeAmount, setTradeAmount] = useState('1.00');
  const [tradeDuration, setTradeDuration] = useState('15');
  const [tradeDurationUnit, setTradeDurationUnit] = useState('m');
  const [tradeMode, setTradeMode] = useState<'DEMO' | 'REAL'>('DEMO');
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);

  // Load everything on mount
  useEffect(() => {
    fetchSettings(true);
    fetchTrades();

    const interval = setInterval(() => {
      syncTradesSilently();
      fetchSettings(false); // Auto-refresh scan logs, settings, and watchlist without overwriting user drafts
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async (isInitial: boolean = false) => {
    try {
      const res = await fetch('/api/deriv/settings');
      const data = await res.json();
      if (res.ok && data.success) {
        setAppId(data.appId || '');
        setApiToken(data.apiToken || '');
        setDemoAccount(data.demoAccount || '');
        setRealAccount(data.realAccount || '');
        setDemoBalance(data.demoBalance || 0);
        setRealBalance(data.realBalance || 0);
        setTradingMode(data.tradingMode || 'DEMO');
        setTradeMode(data.tradingMode || 'DEMO');
        setDerivBotEnabled(data.botEnabled || false);
        setLastScanAt(data.lastScanAt || '');
        setLastScanLogs(data.lastScanLogs || []);
        
        const activeStrats = data.activeStrategies || ['FOREX_15M_MTF'];
        setActiveStrategies(activeStrats);
        
        const savedPairs = data.derivSelectedPairs || ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY'];
        setSelectedPairs(savedPairs);

        // Only overwrite draft user-facing checkboxes on initial load
        if (isInitial) {
          setDraftStrategies(activeStrats);
          setDashboardMaxTrades(String(data.derivMaxTrades || 10));
          setDashboardStakeAmount(String(data.derivStakeAmount || '1.00'));
          setDraftPairs(savedPairs);
          setNewsFilterEnabled(data.derivNewsFilterEnabled !== false);
          setSessionFilterEnabled(data.derivSessionFilterEnabled !== false);
          setCooldownFilterEnabled(data.derivCooldownFilterEnabled !== false);
          setDailyLimitEnabled(data.derivDailyLimitEnabled !== false);
        }
        
        setNearEntryPairs(data.derivNearEntryPairs || []);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchTrades = async () => {
    setIsLoadingTrades(true);
    try {
      const res = await fetch('/api/deriv/trade');
      const data = await res.json();
      if (res.ok && data.success) {
        setTrades(data.trades || []);
      }
    } catch (err) {
      console.error('Error fetching trades:', err);
    } finally {
      setIsLoadingTrades(false);
    }
  };

  const syncTradesSilently = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/deriv/trade');
      const data = await res.json();
      if (res.ok && data.success) {
        const previousOpenIds = trades.filter(t => t.status === 'OPEN').map(t => t.id);
        const newTrades: DerivTrade[] = data.trades || [];
        
        newTrades.forEach(nt => {
          if (previousOpenIds.includes(nt.id) && nt.status === 'WON') {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.8 },
              colors: ['#10b981', '#34d399', '#6ee7b7']
            });
          }
        });

        setTrades(newTrades);
      }
      
      // Also fetch logs to update scanner box
      const settingsRes = await fetch('/api/deriv/settings');
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData.success) {
        setLastScanAt(settingsData.lastScanAt || '');
        setLastScanLogs(settingsData.lastScanLogs || []);
        setDemoBalance(settingsData.demoBalance || 0);
        setRealBalance(settingsData.realBalance || 0);
      }
    } catch (err) {
      console.error('Error syncing:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleForceScan = async () => {
    setIsForceScanning(true);
    try {
      const response = await fetch('/api/deriv/cron', {
        method: 'GET'
      });
      const data = await response.json();
      if (data.success) {
        // Refresh settings to get new logs and watchlist immediately
        await fetchSettings();
        await fetchTrades();
      } else {
        alert(`Scan failed: ${data.error || 'Unknown error'}`);
        // Still refresh to load the latest error logs in the terminal log
        await fetchSettings();
      }
    } catch (err: any) {
      alert(`Network error during scan: ${err.message}`);
    } finally {
      setIsForceScanning(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          apiToken,
          demoAccount,
          realAccount,
          tradingMode,
          botEnabled: derivBotEnabled,
          activeStrategies,
          derivMaxTrades: parseInt(dashboardMaxTrades),
          derivStakeAmount: parseFloat(dashboardStakeAmount),
          derivSelectedPairs: selectedPairs,
          derivNewsFilterEnabled: newsFilterEnabled,
          derivSessionFilterEnabled: sessionFilterEnabled,
          derivCooldownFilterEnabled: cooldownFilterEnabled,
          derivDailyLimitEnabled: dailyLimitEnabled
        }),
      });

      fetchSettings(true);
      const data = await res.json();
      if (res.ok && data.success) {
        setSettingsMessage({
          type: 'success',
          text: 'Deriv settings saved successfully!',
        });
        confetti({
          particleCount: 50,
          spread: 40,
          origin: { y: 0.8 }
        });
      } else {
        setSettingsMessage({
          type: 'error',
          text: data.error || 'Failed to save settings.',
        });
      }
    } catch (err: any) {
      setSettingsMessage({
        type: 'error',
        text: err.message || 'Error saving settings.',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleStrategyDraft = (id: string) => {
    if (draftStrategies.includes(id)) {
      setDraftStrategies(draftStrategies.filter(x => x !== id));
    } else {
      setDraftStrategies([...draftStrategies, id]);
    }
  };

  const handleTogglePairDraft = (id: string) => {
    if (draftPairs.includes(id)) {
      setDraftPairs(draftPairs.filter(x => x !== id));
    } else {
      setDraftPairs([...draftPairs, id]);
    }
  };

  const handleToggleRiskFilter = async (filterType: string, currentValue: boolean) => {
    setIsSavingRiskToggles(true);
    const newValue = !currentValue;
    
    // Set UI state immediately
    if (filterType === 'news') setNewsFilterEnabled(newValue);
    if (filterType === 'session') setSessionFilterEnabled(newValue);
    if (filterType === 'cooldown') setCooldownFilterEnabled(newValue);
    if (filterType === 'daily') setDailyLimitEnabled(newValue);

    try {
      await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          apiToken,
          demoAccount,
          realAccount,
          tradingMode,
          botEnabled: derivBotEnabled,
          activeStrategies,
          derivMaxTrades: parseInt(dashboardMaxTrades),
          derivStakeAmount: parseFloat(dashboardStakeAmount),
          derivSelectedPairs: selectedPairs,
          derivNewsFilterEnabled: filterType === 'news' ? newValue : newsFilterEnabled,
          derivSessionFilterEnabled: filterType === 'session' ? newValue : sessionFilterEnabled,
          derivCooldownFilterEnabled: filterType === 'cooldown' ? newValue : cooldownFilterEnabled,
          derivDailyLimitEnabled: filterType === 'daily' ? newValue : dailyLimitEnabled
        })
      });
      confetti({ particleCount: 25, spread: 25, origin: { y: 0.85 } });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRiskToggles(false);
    }
  };

  const handleSaveActiveStrategies = async () => {
    setIsSavingStrategies(true);
    try {
      const res = await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          apiToken,
          demoAccount,
          realAccount,
          tradingMode,
          botEnabled: derivBotEnabled,
          activeStrategies: draftStrategies,
          derivMaxTrades: parseInt(dashboardMaxTrades),
          derivStakeAmount: parseFloat(dashboardStakeAmount),
          derivSelectedPairs: draftPairs,
          derivNewsFilterEnabled: newsFilterEnabled,
          derivSessionFilterEnabled: sessionFilterEnabled,
          derivCooldownFilterEnabled: cooldownFilterEnabled,
          derivDailyLimitEnabled: dailyLimitEnabled
        }),
      });

      if (res.ok) {
        setActiveStrategies(draftStrategies);
        setSelectedPairs(draftPairs);
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingStrategies(false);
    }
  };

  const handleSaveMaxTrades = async () => {
    setIsSavingMaxTrades(true);
    try {
      const res = await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          apiToken,
          demoAccount,
          realAccount,
          tradingMode,
          botEnabled: derivBotEnabled,
          activeStrategies,
          derivMaxTrades: parseInt(dashboardMaxTrades),
          derivStakeAmount: parseFloat(dashboardStakeAmount),
          derivSelectedPairs: selectedPairs,
          derivNewsFilterEnabled: newsFilterEnabled,
          derivSessionFilterEnabled: sessionFilterEnabled,
          derivCooldownFilterEnabled: cooldownFilterEnabled,
          derivDailyLimitEnabled: dailyLimitEnabled
        })
      });
      if (res.ok) {
        confetti({ particleCount: 40, spread: 30, origin: { y: 0.8 } });
        alert('Max Trades limit updated successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingMaxTrades(false);
    }
  };

  const handleSaveStakeAmount = async () => {
    setIsSavingStake(true);
    try {
      const res = await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          apiToken,
          demoAccount,
          realAccount,
          tradingMode,
          botEnabled: derivBotEnabled,
          activeStrategies,
          derivMaxTrades: parseInt(dashboardMaxTrades),
          derivStakeAmount: parseFloat(dashboardStakeAmount),
          derivSelectedPairs: selectedPairs,
          derivNewsFilterEnabled: newsFilterEnabled,
          derivSessionFilterEnabled: sessionFilterEnabled,
          derivCooldownFilterEnabled: cooldownFilterEnabled,
          derivDailyLimitEnabled: dailyLimitEnabled
        })
      });
      if (res.ok) {
        confetti({ particleCount: 45, spread: 30, origin: { y: 0.8 } });
        alert('Trade Price (Stake) updated successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingStake(false);
    }
  };

  const runDiagnostics = async () => {
    setIsTestingProject(true);
    try {
      const res = await fetch('/api/deriv/settings');
      const data = await res.json();
      if (res.ok && data.success && !data.isFallback && data.appId) {
        alert('🟢 Deriv Bot Connection Diagnostic: Success!\nApp ID & API Token PAT validation passed. Account lists retrieved successfully.');
      } else {
        alert('🔴 Deriv Bot Connection Diagnostic: Failed!\nPlease verify your App ID, API Token and Account IDs under Settings.');
      }
    } catch (err: any) {
      alert(`🔴 Error running diagnostics: ${err.message}`);
    } finally {
      setIsTestingProject(false);
    }
  };

  const runTestTrade = async () => {
    const confirm = window.confirm(`Are you sure you want to place a market TEST TRADE ($1 Stake CALL) on ${tradingMode === 'REAL' ? 'REAL LIVE' : 'DEMO SANDBOX'}?\n\nThis will execute immediately on Deriv.`);
    if (!confirm) return;
    setIsTestingTrade(true);
    try {
      const res = await fetch('/api/deriv/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'frxEURUSD',
          contractType: 'CALL',
          amount: '1.00',
          duration: '15',
          durationUnit: 'm',
          isPaper: tradingMode === 'DEMO'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🎉 Test trade executed!\nContract ID: ${data.trade.contract_id}`);
        fetchTrades();
      } else {
        alert(`❌ Test trade failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`❌ Network error: ${err.message}`);
    } finally {
      setIsTestingTrade(false);
    }
  };

  const toggleBot = async () => {
    setIsTogglingBot(true);
    const newStatus = !derivBotEnabled;
    try {
      const res = await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          apiToken,
          demoAccount,
          realAccount,
          tradingMode,
          botEnabled: newStatus,
          activeStrategies,
          derivMaxTrades: parseInt(dashboardMaxTrades),
          derivStakeAmount: parseFloat(dashboardStakeAmount),
          derivSelectedPairs: selectedPairs,
          derivNewsFilterEnabled: newsFilterEnabled,
          derivSessionFilterEnabled: sessionFilterEnabled,
          derivCooldownFilterEnabled: cooldownFilterEnabled,
          derivDailyLimitEnabled: dailyLimitEnabled
        })
      });
      if (res.ok) {
        setDerivBotEnabled(newStatus);
        if (newStatus) {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 }, colors: ['#10b981', '#34d399'] });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingBot(false);
    }
  };

  const handleEmergencyClose = async () => {
    const confirm = window.confirm("Are you sure you want to instantly CLOSE all open Deriv options contracts in the database?");
    if (!confirm) return;
    setIsClosingAll(true);
    try {
      const res = await fetch('/api/trades/close-all?mode=sandbox', {
        method: 'POST'
      });
      if (res.ok) {
        fetchTrades();
        alert('Emergency Close: All active options contracts have been closed.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClosingAll(false);
    }
  };

  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecutingTrade(true);

    try {
      const res = await fetch('/api/deriv/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: tradeSymbol,
          contractType: tradeType,
          amount: tradeAmount,
          duration: tradeDuration,
          durationUnit: tradeDurationUnit,
          isPaper: tradeMode === 'DEMO',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🎉 Options contract purchased successfully!\nContract ID: ${data.trade.contract_id}`);
        fetchTrades();
      } else {
        alert(`❌ Trade execution failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`❌ Error executing trade: ${err.message}`);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  const handleCloseAllTrades = async () => {
    const confirm = window.confirm("Are you sure you want to CLOSE and archive all Deriv trades in the database?");
    if (!confirm) return;

    setIsSyncing(true);
    try {
      const res = await fetch('/api/trades/close-all?mode=sandbox', {
        method: 'POST',
      });
      if (res.ok) {
        fetchTrades();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const openTrades = trades.filter((t) => t.status === 'OPEN');
  const closedTrades = trades.filter((t) => t.status !== 'OPEN');

  const totalSimulatedPnl = closedTrades.reduce((sum, t) => sum + parseFloat(t.pnl as any || 0), 0);
  const winRate =
    closedTrades.length > 0
      ? (closedTrades.filter((t) => t.status === 'WON').length / closedTrades.length) * 100
      : 0;

  const hasUnsavedConfig =
    JSON.stringify(activeStrategies.sort()) !== JSON.stringify(draftStrategies.sort()) ||
    JSON.stringify(selectedPairs.sort()) !== JSON.stringify(draftPairs.sort());

  const filteredStrategies = STRATEGIES_LIST.filter(s => s.name.toLowerCase().includes(searchEnginesQuery.toLowerCase()) || s.desc.toLowerCase().includes(searchEnginesQuery.toLowerCase()));
  const filteredDerivedPairs = DERIVED_PAIRS_LIST.filter(p => p.name.toLowerCase().includes(searchDerivedQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchDerivedQuery.toLowerCase()));
  const filteredForexPairs = FOREX_PAIRS_LIST.filter(p => p.name.toLowerCase().includes(searchForexQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchForexQuery.toLowerCase()));
  const filteredStocksPairs = STOCKS_INDICES_PAIRS_LIST.filter(p => p.name.toLowerCase().includes(searchStocksQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchStocksQuery.toLowerCase()));
  const filteredCommoditiesPairs = COMMODITIES_PAIRS_LIST.filter(p => p.name.toLowerCase().includes(searchCommoditiesQuery.toLowerCase()) || p.desc.toLowerCase().includes(searchCommoditiesQuery.toLowerCase()));

  const derivedTickedCount = draftPairs.filter(id => DERIVED_PAIRS_LIST.some(p => p.id === id)).length;
  const forexTickedCount = draftPairs.filter(id => FOREX_PAIRS_LIST.some(p => p.id === id)).length;
  const stocksTickedCount = draftPairs.filter(id => STOCKS_INDICES_PAIRS_LIST.some(p => p.id === id)).length;
  const commoditiesTickedCount = draftPairs.filter(id => COMMODITIES_PAIRS_LIST.some(p => p.id === id)).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-zinc-800/80 pb-5 gap-6">
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-100 flex items-center gap-2.5">
            <LineChart className="w-7 h-7 text-emerald-400" />
            <span>Deriv Options Dashboard</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time Deriv {tradingMode === 'REAL' ? 'Live Production' : 'Demo Sandbox'} options engine tracker.
          </p>
        </div>

        {/* Bot Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Symbol to View Chart */}
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedChartSymbol(e.target.value);
                  window.open(`https://tradingview.com/chart/?symbol=DERIV:${e.target.value}`, '_blank');
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-300 shadow-md cursor-pointer outline-none max-w-[150px]"
            >
              <option value="" disabled>View Charts</option>
              <option value="frxEURUSD">EUR/USD</option>
              <option value="frxGBPUSD">GBP/USD</option>
              <option value="frxUSDJPY">USD/JPY</option>
            </select>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={isTestingProject}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 text-emerald-400 ${isTestingProject ? 'animate-pulse' : ''}`} />
            <span>{isTestingProject ? 'Testing...' : 'Test Project'}</span>
          </button>

          <button
            onClick={runTestTrade}
            disabled={isTestingTrade}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-850 rounded-2xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50"
          >
            <FlaskConical className={`w-4 h-4 text-purple-400 ${isTestingTrade ? 'animate-spin' : ''}`} />
            <span>Test Trade</span>
          </button>

          {/* Max Open Trades Inline Controller */}
          <div className="flex items-center gap-2 bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800/80 px-4 py-2.5 rounded-2xl shadow-md transition-all duration-300">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block whitespace-nowrap">Max Trades:</span>
            <input
              type="number"
              min="1"
              max="100"
              value={dashboardMaxTrades}
              onChange={(e) => setDashboardMaxTrades(e.target.value)}
              className="w-12 bg-zinc-950 border border-zinc-800 rounded-xl py-1 px-1.5 font-mono text-center font-bold text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/85 focus:ring-1 focus:ring-emerald-500/20"
            />
            <button
              onClick={handleSaveMaxTrades}
              disabled={isSavingMaxTrades}
              className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingMaxTrades ? 'Saving...' : 'Set'}
            </button>
          </div>

          {/* Stake / Trade Price Inline Controller */}
          <div className="flex items-center gap-2 bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800/80 px-4 py-2.5 rounded-2xl shadow-md transition-all duration-300">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block whitespace-nowrap">Stake:</span>
            <input
              type="number"
              step="0.1"
              min="0.35"
              value={dashboardStakeAmount}
              onChange={(e) => setDashboardStakeAmount(e.target.value)}
              className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl py-1 px-1.5 font-mono text-center font-bold text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/85 focus:ring-1 focus:ring-emerald-500/20"
            />
            <button
              onClick={handleSaveStakeAmount}
              disabled={isSavingStake}
              className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingStake ? 'Saving...' : 'Set'}
            </button>
          </div>

          <button
            onClick={toggleBot}
            disabled={isTogglingBot}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer ${
              derivBotEnabled
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20 shadow-md'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
          >
            {derivBotEnabled ? (
              <>
                <Play className="w-4 h-4 fill-white animate-pulse" />
                <span>BOT RUNNING</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 fill-zinc-450 text-zinc-450" />
                <span>BOT STOPPED</span>
              </>
            )}
          </button>

          <button
            onClick={handleEmergencyClose}
            disabled={isClosingAll}
            className="flex items-center gap-2 px-5 py-3 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 rounded-2xl text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50"
            title="Instantly close all open positions on Deriv and reset database trades"
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>{isClosingAll ? 'Closing All...' : 'Emergency Close'}</span>
          </button>

          <button
            onClick={fetchTrades}
            disabled={isLoadingTrades || isSyncing}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-850 hover:text-emerald-400 text-zinc-400 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="Refresh Dashboard Data"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing || isLoadingTrades ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left sidebar strategy list, Right main dashboard panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Column Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* 1. Active Engines Box */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Active Engines</h3>
                <p className="text-[8px] text-zinc-500 leading-tight">Select active engines to run.</p>
              </div>
            </div>

            {/* Search Box */}
            <input
              type="text"
              placeholder="🔍 Search engines..."
              value={searchEnginesQuery}
              onChange={(e) => setSearchEnginesQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-xl text-[9px] text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-all font-mono"
            />

            {/* Select All Checkbox */}
            {filteredStrategies.length > 0 && (
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-900/30 border border-zinc-850/40 text-[9px] font-black text-zinc-400">
                <span className="uppercase tracking-wider">Select All Filtered</span>
                <input
                  type="checkbox"
                  checked={filteredStrategies.every(s => draftStrategies.includes(s.id))}
                  onChange={() => {
                    const allChecked = filteredStrategies.every(s => draftStrategies.includes(s.id));
                    const filteredIds = filteredStrategies.map(s => s.id);
                    if (allChecked) {
                      setDraftStrategies(draftStrategies.filter(id => !filteredIds.includes(id)));
                    } else {
                      setDraftStrategies(draftStrategies.concat(filteredIds.filter(id => !draftStrategies.includes(id))));
                    }
                  }}
                  className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-emerald-500 checked:border-emerald-500 accent-emerald-500 cursor-pointer"
                />
              </div>
            )}

            {/* Items List */}
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {filteredStrategies.map((strat) => {
                const isTicked = draftStrategies.includes(strat.id);
                const isSelected = activeStrategies.includes(strat.id);
                return (
                  <div
                    key={strat.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-[9px] font-bold ${
                      isSelected
                        ? 'bg-emerald-950/20 text-emerald-400 font-extrabold border border-emerald-500/10'
                        : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                    }`}
                  >
                    <span className="truncate mr-2 uppercase tracking-wide">{strat.name}</span>
                    <input
                      type="checkbox"
                      checked={isTicked}
                      onChange={() => handleToggleStrategyDraft(strat.id)}
                      className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-emerald-500 checked:border-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                );
              })}
              {filteredStrategies.length === 0 && (
                <p className="text-[9px] text-zinc-650 text-center py-2">No strategies found.</p>
              )}
            </div>

            {/* Save Button */}
            {JSON.stringify(activeStrategies.sort()) !== JSON.stringify(draftStrategies.sort()) && (
              <div className="pt-2 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={handleSaveActiveStrategies}
                  disabled={isSavingStrategies}
                  className="w-full py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-300 shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  {isSavingStrategies ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>

          {/* 2. Standardized Market Pairs Terminal (4 Categories: Derived, Forex, Cryptocurrencies, Commodities) */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-4 space-y-4 shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Market Pairs</h3>
                <span className="text-[8px] font-mono text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                  {draftPairs.length} Active Total
                </span>
              </div>
              <p className="text-[8px] text-zinc-500 leading-tight mt-0.5">Filter by category to activate and trade pairs.</p>
            </div>

            {/* 4 Category Selector Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950/80 border border-zinc-850 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveMarketTab('derived')}
                className={`py-1.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer ${
                  activeMarketTab === 'derived'
                    ? 'bg-blue-950/50 text-blue-300 border border-blue-800/50 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
              >
                <span>⚡ Derived</span>
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800">
                  {derivedTickedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMarketTab('forex')}
                className={`py-1.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer ${
                  activeMarketTab === 'forex'
                    ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
              >
                <span>🌐 Forex</span>
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800">
                  {forexTickedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMarketTab('stocks')}
                className={`py-1.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer ${
                  activeMarketTab === 'stocks'
                    ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
              >
                <span>📈 Stocks & Indices</span>
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800">
                  {stocksTickedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMarketTab('commodities')}
                className={`py-1.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer ${
                  activeMarketTab === 'commodities'
                    ? 'bg-purple-950/50 text-purple-300 border border-purple-800/50 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
              >
                <span>🥇 Commodities</span>
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800">
                  {commoditiesTickedCount}
                </span>
              </button>
            </div>

            {/* Category 1: Derived Content */}
            {activeMarketTab === 'derived' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="🔍 Search derived (Step, Vol, Jump, Boom/Crash)..."
                  value={searchDerivedQuery}
                  onChange={(e) => setSearchDerivedQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-xl text-[9px] text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                />

                {filteredDerivedPairs.length > 0 && (
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-900/30 border border-zinc-850/40 text-[9px] font-black text-zinc-400">
                    <span className="uppercase tracking-wider">Select All Derived ({filteredDerivedPairs.length})</span>
                    <input
                      type="checkbox"
                      checked={filteredDerivedPairs.every(p => draftPairs.includes(p.id))}
                      onChange={() => {
                        const allChecked = filteredDerivedPairs.every(p => draftPairs.includes(p.id));
                        const filteredIds = filteredDerivedPairs.map(p => p.id);
                        if (allChecked) {
                          setDraftPairs(draftPairs.filter(id => !filteredIds.includes(id)));
                        } else {
                          setDraftPairs(draftPairs.concat(filteredIds.filter(id => !draftPairs.includes(id))));
                        }
                      }}
                      className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-blue-500 checked:border-blue-500 accent-blue-500 cursor-pointer"
                    />
                  </div>
                )}

                <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                  {filteredDerivedPairs.map((pair) => {
                    const isTicked = draftPairs.includes(pair.id);
                    const isSelected = selectedPairs.includes(pair.id);
                    return (
                      <div
                        key={pair.id}
                        className={`flex items-center justify-between px-2 py-1 rounded-lg text-[9px] font-bold ${
                          isSelected
                            ? 'bg-blue-950/20 text-blue-300 font-extrabold border border-blue-500/15'
                            : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                        }`}
                        title={pair.desc}
                      >
                        <span className="truncate max-w-[130px]">{pair.name}</span>
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => handleTogglePairDraft(pair.id)}
                          className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-blue-500 checked:border-blue-500 accent-blue-500 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                  {filteredDerivedPairs.length === 0 && (
                    <p className="text-[9px] text-zinc-650 text-center py-2">No derived pairs found.</p>
                  )}
                </div>
              </div>
            )}

            {/* Category 2: Forex Content */}
            {activeMarketTab === 'forex' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="🔍 Search forex (EUR, GBP, JPY, AUD, Baskets)..."
                  value={searchForexQuery}
                  onChange={(e) => setSearchForexQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-xl text-[9px] text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                />

                {filteredForexPairs.length > 0 && (
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-900/30 border border-zinc-850/40 text-[9px] font-black text-zinc-400">
                    <span className="uppercase tracking-wider">Select All Forex ({filteredForexPairs.length})</span>
                    <input
                      type="checkbox"
                      checked={filteredForexPairs.every(p => draftPairs.includes(p.id))}
                      onChange={() => {
                        const allChecked = filteredForexPairs.every(p => draftPairs.includes(p.id));
                        const filteredIds = filteredForexPairs.map(p => p.id);
                        if (allChecked) {
                          setDraftPairs(draftPairs.filter(id => !filteredIds.includes(id)));
                        } else {
                          setDraftPairs(draftPairs.concat(filteredIds.filter(id => !draftPairs.includes(id))));
                        }
                      }}
                      className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-emerald-500 checked:border-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                )}

                <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                  {filteredForexPairs.map((pair) => {
                    const isTicked = draftPairs.includes(pair.id);
                    const isSelected = selectedPairs.includes(pair.id);
                    return (
                      <div
                        key={pair.id}
                        className={`flex items-center justify-between px-2 py-1 rounded-lg text-[9px] font-bold ${
                          isSelected
                            ? 'bg-emerald-950/20 text-emerald-400 font-extrabold border border-emerald-500/15'
                            : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                        }`}
                        title={pair.desc}
                      >
                        <span className="truncate max-w-[130px]">{pair.name}</span>
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => handleTogglePairDraft(pair.id)}
                          className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-emerald-500 checked:border-emerald-500 accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                  {filteredForexPairs.length === 0 && (
                    <p className="text-[9px] text-zinc-650 text-center py-2">No forex pairs found.</p>
                  )}
                </div>
              </div>
            )}

            {/* Category 3: Stocks & Indices Content */}
            {activeMarketTab === 'stocks' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="🔍 Search stocks & indices (US 500, Wall St, Tech 100, Japan 225)..."
                  value={searchStocksQuery}
                  onChange={(e) => setSearchStocksQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-xl text-[9px] text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                />

                {filteredStocksPairs.length > 0 && (
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-900/30 border border-zinc-850/40 text-[9px] font-black text-zinc-400">
                    <span className="uppercase tracking-wider">Select All Stocks & Indices ({filteredStocksPairs.length})</span>
                    <input
                      type="checkbox"
                      checked={filteredStocksPairs.every(p => draftPairs.includes(p.id))}
                      onChange={() => {
                        const allChecked = filteredStocksPairs.every(p => draftPairs.includes(p.id));
                        const filteredIds = filteredStocksPairs.map(p => p.id);
                        if (allChecked) {
                          setDraftPairs(draftPairs.filter(id => !filteredIds.includes(id)));
                        } else {
                          setDraftPairs(draftPairs.concat(filteredIds.filter(id => !draftPairs.includes(id))));
                        }
                      }}
                      className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-amber-500 checked:border-amber-500 accent-amber-500 cursor-pointer"
                    />
                  </div>
                )}

                <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                  {filteredStocksPairs.map((pair) => {
                    const isTicked = draftPairs.includes(pair.id);
                    const isSelected = selectedPairs.includes(pair.id);
                    return (
                      <div
                        key={pair.id}
                        className={`flex items-center justify-between px-2 py-1 rounded-lg text-[9px] font-bold ${
                          isSelected
                            ? 'bg-amber-950/20 text-amber-300 font-extrabold border border-amber-500/15'
                            : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                        }`}
                        title={pair.desc}
                      >
                        <span className="truncate max-w-[130px]">{pair.name}</span>
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => handleTogglePairDraft(pair.id)}
                          className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-amber-500 checked:border-amber-500 accent-amber-500 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                  {filteredStocksPairs.length === 0 && (
                    <p className="text-[9px] text-zinc-650 text-center py-2">No stocks or indices found.</p>
                  )}
                </div>
              </div>
            )}

            {/* Category 4: Commodities Content */}
            {activeMarketTab === 'commodities' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="🔍 Search commodities (Gold, Silver, Metals)..."
                  value={searchCommoditiesQuery}
                  onChange={(e) => setSearchCommoditiesQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 rounded-xl text-[9px] text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-all font-mono"
                />

                {filteredCommoditiesPairs.length > 0 && (
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-900/30 border border-zinc-850/40 text-[9px] font-black text-zinc-400">
                    <span className="uppercase tracking-wider">Select All Commodities ({filteredCommoditiesPairs.length})</span>
                    <input
                      type="checkbox"
                      checked={filteredCommoditiesPairs.every(p => draftPairs.includes(p.id))}
                      onChange={() => {
                        const allChecked = filteredCommoditiesPairs.every(p => draftPairs.includes(p.id));
                        const filteredIds = filteredCommoditiesPairs.map(p => p.id);
                        if (allChecked) {
                          setDraftPairs(draftPairs.filter(id => !filteredIds.includes(id)));
                        } else {
                          setDraftPairs(draftPairs.concat(filteredIds.filter(id => !draftPairs.includes(id))));
                        }
                      }}
                      className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-purple-500 checked:border-purple-500 accent-purple-500 cursor-pointer"
                    />
                  </div>
                )}

                <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                  {filteredCommoditiesPairs.map((pair) => {
                    const isTicked = draftPairs.includes(pair.id);
                    const isSelected = selectedPairs.includes(pair.id);
                    return (
                      <div
                        key={pair.id}
                        className={`flex items-center justify-between px-2 py-1 rounded-lg text-[9px] font-bold ${
                          isSelected
                            ? 'bg-purple-950/20 text-purple-300 font-extrabold border border-purple-500/15'
                            : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                        }`}
                        title={pair.desc}
                      >
                        <span className="truncate max-w-[130px]">{pair.name}</span>
                        <input
                          type="checkbox"
                          checked={isTicked}
                          onChange={() => handleTogglePairDraft(pair.id)}
                          className="w-3 h-3 border border-zinc-700 rounded bg-zinc-950 checked:bg-purple-500 checked:border-purple-500 accent-purple-500 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                  {filteredCommoditiesPairs.length === 0 && (
                    <p className="text-[9px] text-zinc-650 text-center py-2">No commodities found.</p>
                  )}
                </div>
              </div>
            )}

            {/* Master Save Button for Market Pairs */}
            {JSON.stringify(selectedPairs.sort()) !== JSON.stringify(draftPairs.sort()) && (
              <div className="pt-2 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={handleSaveActiveStrategies}
                  disabled={isSavingStrategies}
                  className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingStrategies ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Manual Trade proposal widget */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-wider">
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manual Execution</span>
            </h3>

            <form onSubmit={handleExecuteTrade} className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Asset Symbol</label>
                <select
                  value={tradeSymbol}
                  onChange={(e) => setTradeSymbol(e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-bold text-zinc-300 outline-none focus:border-zinc-700 cursor-pointer"
                >
                  <option value="frxEURUSD">EUR/USD (Forex - 15m Expiry)</option>
                  <option value="frxGBPUSD">GBP/USD (Forex - 15m Expiry)</option>
                  <option value="frxUSDJPY">USD/JPY (Forex - 15m Expiry)</option>
                  <option value="1HZ100V">Volatility 100 (1s) Index</option>
                  <option value="1HZ50V">Volatility 50 (1s) Index</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Direction</label>
                  <div className="flex bg-zinc-950 border border-zinc-800 p-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTradeType('CALL')}
                      className={`flex-1 py-1 rounded-lg text-[9px] font-black transition-all ${
                        tradeType === 'CALL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/25' : 'text-zinc-650'
                      }`}
                    >
                      Rise
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeType('PUT')}
                      className={`flex-1 py-1 rounded-lg text-[9px] font-black transition-all ${
                        tradeType === 'PUT' ? 'bg-red-500/20 text-red-400 border border-red-500/25' : 'text-zinc-650'
                      }`}
                    >
                      Fall
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Mode</label>
                  <select
                    value={tradeMode}
                    onChange={(e) => setTradeMode(e.target.value as any)}
                    className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-bold text-zinc-300 outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    <option value="DEMO">Demo Sandbox</option>
                    <option value="REAL">Real Account</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Stake</label>
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Duration</label>
                  <input
                    type="number"
                    value={tradeDuration}
                    onChange={(e) => setTradeDuration(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Unit</label>
                  <select
                    value={tradeDurationUnit}
                    onChange={(e) => setTradeDurationUnit(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-bold text-zinc-300 outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    <option value="m">Minutes</option>
                    <option value="s">Seconds</option>
                    <option value="t">Ticks</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isExecutingTrade}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                {isExecutingTrade ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span>Purchase Contract</span>
                )}
              </button>
            </form>
          </div>

          {/* Credentials Settings Toggle widget */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-wider">
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span>Deriv API Credentials</span>
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">App ID</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  placeholder="App ID"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">API Token (PAT)</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono pr-8"
                    placeholder="pat_..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-zinc-500 hover:text-zinc-350"
                  >
                    {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Demo ID</label>
                  <input
                    type="text"
                    value={demoAccount}
                    onChange={(e) => setDemoAccount(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                    placeholder="DOT..."
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Real ID</label>
                  <input
                    type="text"
                    value={realAccount}
                    onChange={(e) => setRealAccount(e.target.value)}
                    className="w-full px-2 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[10px] font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                    placeholder="ROT..."
                  />
                </div>
              </div>

              {settingsMessage.text && (
                <div className={`p-2 rounded-xl text-[9px] font-semibold border flex gap-1 ${
                  settingsMessage.type === 'success' ? 'bg-emerald-950/15 border-emerald-900/40 text-emerald-400' : 'bg-red-950/15 border-red-900/40 text-red-400'
                }`}>
                  <span>{settingsMessage.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                {isSavingSettings ? 'Saving...' : 'Save Credentials'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column Panel */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Active Engine Toggle Banner (Matches Binance Dashboard Header perfectly) */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6 shadow-md">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <span className="flex h-4 w-4 relative">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${derivBotEnabled ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-4 w-4 ${derivBotEnabled ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  </span>
                </div>

                <div>
                  <h3 className="text-md font-extrabold text-zinc-100 flex items-center gap-2">
                    <span>Deriv Active Options Engine</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${derivBotEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-red-950 text-red-400 border border-red-500/20'}`}>
                      {derivBotEnabled ? 'ENGINE ACTIVE' : 'ENGINE PAUSED'}
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Active Account Mode: <span className="font-extrabold text-zinc-300">{tradingMode} Sandbox</span> | Pulse interval: <span className="font-mono">30s</span>
                  </p>
                </div>
              </div>

              {/* Switchers */}
              <div className="flex flex-wrap gap-3 items-center">
                {/* Bot Work Status */}
                <div className="flex bg-[#09090b]/80 border border-zinc-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={async () => {
                      setDerivBotEnabled(true);
                      await fetch('/api/deriv/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode, botEnabled: true, activeStrategies, derivMaxTrades: parseInt(dashboardMaxTrades), derivStakeAmount: parseFloat(dashboardStakeAmount), derivSelectedPairs: selectedPairs, derivNewsFilterEnabled: newsFilterEnabled, derivSessionFilterEnabled: sessionFilterEnabled, derivCooldownFilterEnabled: cooldownFilterEnabled, derivDailyLimitEnabled: dailyLimitEnabled })
                      });
                      fetchSettings();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      derivBotEnabled ? 'bg-emerald-500 text-zinc-950 shadow-md font-black' : 'text-zinc-550 hover:text-zinc-350'
                    }`}
                  >
                    WORK ON
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setDerivBotEnabled(false);
                      await fetch('/api/deriv/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode, botEnabled: false, activeStrategies, derivMaxTrades: parseInt(dashboardMaxTrades), derivStakeAmount: parseFloat(dashboardStakeAmount), derivSelectedPairs: selectedPairs, derivNewsFilterEnabled: newsFilterEnabled, derivSessionFilterEnabled: sessionFilterEnabled, derivCooldownFilterEnabled: cooldownFilterEnabled, derivDailyLimitEnabled: dailyLimitEnabled })
                      });
                      fetchSettings();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      !derivBotEnabled ? 'bg-red-500 text-zinc-950 shadow-md font-black' : 'text-zinc-550 hover:text-zinc-350'
                    }`}
                  >
                    WORK OFF
                  </button>
                </div>

                {/* Segmented Switcher */}
                <div className="flex bg-[#09090b]/80 border border-zinc-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={async () => {
                      setTradingMode('DEMO');
                      await fetch('/api/deriv/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode: 'DEMO', botEnabled: derivBotEnabled, activeStrategies, derivMaxTrades: parseInt(dashboardMaxTrades), derivStakeAmount: parseFloat(dashboardStakeAmount), derivSelectedPairs: selectedPairs, derivNewsFilterEnabled: newsFilterEnabled, derivSessionFilterEnabled: sessionFilterEnabled, derivCooldownFilterEnabled: cooldownFilterEnabled, derivDailyLimitEnabled: dailyLimitEnabled })
                      });
                      fetchSettings();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      tradingMode === 'DEMO' ? 'bg-amber-500 text-zinc-950 shadow-md font-black' : 'text-zinc-550 hover:text-zinc-350'
                    }`}
                  >
                    DEMO SANDBOX
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setTradingMode('REAL');
                      await fetch('/api/deriv/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode: 'REAL', botEnabled: derivBotEnabled, activeStrategies, derivMaxTrades: parseInt(dashboardMaxTrades), derivStakeAmount: parseFloat(dashboardStakeAmount), derivSelectedPairs: selectedPairs, derivNewsFilterEnabled: newsFilterEnabled, derivSessionFilterEnabled: sessionFilterEnabled, derivCooldownFilterEnabled: cooldownFilterEnabled, derivDailyLimitEnabled: dailyLimitEnabled })
                      });
                      fetchSettings();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      tradingMode === 'REAL' ? 'bg-emerald-500 text-zinc-950 shadow-md font-black' : 'text-zinc-550 hover:text-zinc-350'
                    }`}
                  >
                    REAL LIVE
                  </button>
                </div>

                {/* Force Scan Action */}
                <button
                  type="button"
                  disabled={isForceScanning}
                  onClick={handleForceScan}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isForceScanning 
                      ? 'bg-zinc-900/50 text-zinc-650 border-zinc-850/40 cursor-not-allowed' 
                      : 'bg-zinc-950/60 text-zinc-300 border-zinc-800/80 hover:bg-zinc-900/40 hover:text-zinc-200 hover:border-zinc-700/80'
                  }`}
                >
                  {isForceScanning ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 text-zinc-400" />
                      Run Scan Now
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[1px] bg-zinc-800/50 w-full" />

            {/* Safety toggles buttons tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Safety & News Filters</h4>
                {isSavingRiskToggles && <span className="text-[9px] text-emerald-400 animate-pulse font-bold">Saving settings...</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* News Filter Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleRiskFilter('news', newsFilterEnabled)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    newsFilterEnabled
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                      : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider">News Blocker</span>
                  <span className="text-[8px] opacity-60 mt-0.5">USD/EUR/GBP High Impact</span>
                  <span className={`text-[10px] font-black mt-2 px-2 py-0.5 rounded-lg ${newsFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
                    {newsFilterEnabled ? 'GUARD ON' : 'GUARD OFF'}
                  </span>
                </button>

                {/* Session Filter Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleRiskFilter('session', sessionFilterEnabled)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    sessionFilterEnabled
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                      : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider">Asian Session</span>
                  <span className="text-[8px] opacity-60 mt-0.5">21:00 - 23:59 GMT Block</span>
                  <span className={`text-[10px] font-black mt-2 px-2 py-0.5 rounded-lg ${sessionFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
                    {sessionFilterEnabled ? 'GUARD ON' : 'GUARD OFF'}
                  </span>
                </button>

                {/* Loss Cooldown Guard Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleRiskFilter('cooldown', cooldownFilterEnabled)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    cooldownFilterEnabled
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                      : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider">Loss Cooldown</span>
                  <span className="text-[8px] opacity-60 mt-0.5">2 Losses = 60m Cooldown</span>
                  <span className={`text-[10px] font-black mt-2 px-2 py-0.5 rounded-lg ${cooldownFilterEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
                    {cooldownFilterEnabled ? 'GUARD ON' : 'GUARD OFF'}
                  </span>
                </button>

                {/* Daily Trades Limit Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleRiskFilter('daily', dailyLimitEnabled)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                    dailyLimitEnabled
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                      : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-zinc-400 hover:border-zinc-850'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider">Daily Trade Limit</span>
                  <span className="text-[8px] opacity-60 mt-0.5">Max 10 Trades Limit</span>
                  <span className={`text-[10px] font-black mt-2 px-2 py-0.5 rounded-lg ${dailyLimitEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-900 text-zinc-550'}`}>
                    {dailyLimitEnabled ? 'GUARD ON' : 'GUARD OFF'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-zinc-900/60 flex items-center justify-center text-emerald-400 border border-zinc-850">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Live Balance</span>
                <span className="text-xl font-black font-mono mt-0.5 text-zinc-100 block">
                  ${(tradingMode === 'DEMO' ? demoBalance : realBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-zinc-900/60 flex items-center justify-center text-emerald-400 border border-zinc-850">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Today P&L</span>
                <span className={`text-xl font-black font-mono mt-0.5 block ${totalSimulatedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalSimulatedPnl >= 0 ? '+' : ''}{totalSimulatedPnl.toFixed(2)} USD
                </span>
              </div>
            </div>

            <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-zinc-900/60 flex items-center justify-center text-blue-400 border border-zinc-850">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Win Rate %</span>
                <span className="text-xl font-black font-mono mt-0.5 text-zinc-200 block">
                  {winRate.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-zinc-900/60 flex items-center justify-center text-purple-400 border border-zinc-850">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Active Positions</span>
                <span className="text-xl font-black font-mono mt-0.5 text-zinc-200 block">
                  {openTrades.length}
                </span>
              </div>
            </div>
          </div>

          {/* Pairs Near Entry Watchlist */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Pairs Near Entry Watchlist
              </span>
              <span className="text-[9px] text-zinc-500 font-medium">
                Real-time monitoring ({nearEntryPairs.length} active)
              </span>
            </div>
            
            <div className="overflow-x-auto overflow-y-auto max-h-[148px] rounded-2xl border border-zinc-900 bg-[#050507]/40 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-zinc-900 bg-zinc-950/90 text-zinc-500 font-bold uppercase tracking-wider font-mono text-[8px]">
                    <th className="py-2.5 px-4 bg-zinc-950/90">Asset Pair</th>
                    <th className="py-2.5 px-3 bg-zinc-950/90">Direction</th>
                    <th className="py-2.5 px-3 bg-zinc-950/90">Proximity Status</th>
                    <th className="py-2.5 px-3 text-right bg-zinc-950/90">Confirmations (T A S)</th>
                    <th className="py-2.5 px-3 text-right bg-zinc-950/90">ADX</th>
                    <th className="py-2.5 px-4 text-right bg-zinc-950/90">Stoch %K / %D</th>
                    <th className="py-2.5 px-4 text-center bg-zinc-950/90">Chart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 font-medium">
                  {sortedNearEntryPairs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-650 italic">
                        No pairs currently near trade entry criteria. Running active scans...
                      </td>
                    </tr>
                  ) : (
                    sortedNearEntryPairs.map((pair: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-900/20 transition-colors text-zinc-300">
                        <td className="py-2.5 px-4 font-bold text-zinc-200">
                          {getPairDisplayName(pair.symbol)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            pair.direction === 'RISE' 
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' 
                              : 'bg-rose-950/40 text-rose-400 border border-rose-900/40'
                          }`}>
                            {pair.direction === 'RISE' ? '🟢 RISE (CALL)' : '🔴 FALL (PUT)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 font-mono text-[9px]">
                          {pair.reason}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Trend Indicator */}
                            <span 
                              title={pair.confirmations?.trend ? "Trend Aligned (H1 & 15m EMAs match)" : "Trend Disaligned"}
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border transition-all ${
                                pair.confirmations?.trend 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                  : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                              }`}
                            >
                              T
                            </span>
                            {/* ADX Indicator */}
                            <span 
                              title={pair.confirmations?.adx ? "ADX > 22 (Strong Momentum)" : "ADX <= 22 (Weak Momentum)"}
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border transition-all ${
                                pair.confirmations?.adx 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                  : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                              }`}
                            >
                              A
                            </span>
                            {/* Stochastic Zone Indicator */}
                            <span 
                              title={pair.confirmations?.stochZone ? "Stochastic in Oversold/Overbought Trigger Zone" : "Stochastic not in zone"}
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border transition-all ${
                                pair.confirmations?.stochZone 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                  : 'bg-zinc-900 text-zinc-600 border-zinc-800'
                              }`}
                            >
                              S
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-200">
                          {parseFloat(pair.adx).toFixed(1)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-zinc-400">
                          {parseFloat(pair.stochK).toFixed(0)} / {parseFloat(pair.stochD).toFixed(0)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <a
                            href={`https://dtrader.deriv.com/?chart_type=candle&interval=5m&symbol=${pair.symbol}&trade_type=rise_fall`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-2 py-0.5 text-[8px] font-black text-amber-400 bg-amber-950/30 hover:bg-amber-950/60 border border-amber-500/25 hover:border-amber-500/50 rounded-md transition-all uppercase tracking-wider font-mono"
                          >
                            go live chart
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Terminal Scans Log */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Terminal Scans Log
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Last scan: {lastScanAt ? new Date(lastScanAt).toLocaleTimeString() : 'Never'}
              </span>
            </div>
            <div className="bg-[#050507]/90 border border-zinc-900 rounded-2xl p-4 min-h-[160px] max-h-[220px] overflow-y-auto font-mono text-[10px] text-zinc-450 space-y-1.5 scrollbar-thin">
              {lastScanLogs.length === 0 ? (
                <div className="text-zinc-650 italic py-6 text-center">No terminal scan events captured yet. Check if Bot is WORK ON.</div>
              ) : (
                lastScanLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed hover:bg-zinc-900/30 py-0.5 px-1 rounded transition-colors">
                    {log.includes('❌') || log.includes('🚨') ? (
                      <span className="text-red-400">{log}</span>
                    ) : log.includes('🔥') || log.includes('🎉') ? (
                      <span className="text-emerald-400 font-bold">{log}</span>
                    ) : log.includes('⏳') || log.includes('⚠️') ? (
                      <span className="text-amber-500">{log}</span>
                    ) : (
                      <span>{log}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Open Active Contracts */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Active Option Contracts</h3>
              {openTrades.length > 0 && isSyncing && (
                <span className="text-[10px] text-zinc-500 font-medium animate-pulse flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Syncing with Deriv...</span>
                </span>
              )}
            </div>

            {openTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800/80 rounded-2xl">
                <Layers className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500 font-medium">No active contracts running currently</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="pb-3">Contract ID</th>
                      <th className="pb-3">Asset</th>
                      <th className="pb-3 text-center">Type</th>
                      <th className="pb-3 text-right">Stake</th>
                      <th className="pb-3 text-right">Target Payout</th>
                      <th className="pb-3 text-right">Duration</th>
                      <th className="pb-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-sm font-semibold">
                    {openTrades.map((t) => (
                      <tr key={t.id}>
                        <td className="py-3.5 font-mono text-zinc-300 text-xs">{t.contract_id}</td>
                        <td className="py-3.5 text-zinc-200 text-xs">{getPairDisplayName(t.symbol)}</td>
                        <td className="py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${
                            t.contract_type === 'CALL'
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                              : 'bg-red-950/20 border-red-900/50 text-red-400'
                          }`}>
                            {t.contract_type === 'CALL' ? 'RISE' : 'FALL'}
                          </span>
                        </td>
                        <td className="py-3.5 text-right font-mono text-xs text-zinc-300">${t.stake.toFixed(2)}</td>
                        <td className="py-3.5 text-right font-mono text-xs text-zinc-200">${t.payout.toFixed(2)}</td>
                        <td className="py-3.5 text-right text-xs text-zinc-400">{t.duration}{t.duration_unit}</td>
                        <td className="py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 uppercase animate-pulse">
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Closed Option Contracts History */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Trades History</h3>
              {closedTrades.length > 0 && (
                <button
                  onClick={handleCloseAllTrades}
                  className="px-2.5 py-1 text-[9px] font-extrabold bg-red-950/25 border border-red-900/40 text-red-400 hover:text-red-300 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Clear Archive
                </button>
              )}
            </div>

            {closedTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-800/80 rounded-2xl">
                <Layers className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500 font-medium">No recent contracts in history</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="pb-3">Contract ID</th>
                      <th className="pb-3">Asset</th>
                      <th className="pb-3 text-center">Type</th>
                      <th className="pb-3 text-right">Stake</th>
                      <th className="pb-3 text-right">Return P&L</th>
                      <th className="pb-3 text-center">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-sm font-semibold">
                    {closedTrades.map((t) => {
                      const isWin = t.status === 'WON';
                      return (
                        <tr key={t.id} className="hover:bg-zinc-950/20 transition-all">
                          <td className="py-3.5 font-mono text-zinc-400 text-xs">{t.contract_id}</td>
                          <td className="py-3.5 text-zinc-300 text-xs">{getPairDisplayName(t.symbol)}</td>
                          <td className="py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${
                              t.contract_type === 'CALL'
                                ? 'bg-emerald-950/10 border-emerald-900/20 text-emerald-400'
                                : 'bg-red-950/10 border-red-900/20 text-red-400'
                            }`}>
                              {t.contract_type === 'CALL' ? 'RISE' : 'FALL'}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-mono text-xs text-zinc-400">${t.stake.toFixed(2)}</td>
                          <td className={`py-3.5 text-right font-mono text-xs font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isWin ? '+' : ''}{t.pnl.toFixed(2)} USD
                          </td>
                          <td className="py-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                              isWin
                                ? 'bg-emerald-500 text-emerald-950'
                                : 'bg-red-500 text-red-950'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
