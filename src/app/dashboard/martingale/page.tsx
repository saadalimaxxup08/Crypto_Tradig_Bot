'use client';

import { useState, useEffect } from 'react';
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
  DollarSign
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

const ALL_AVAILABLE_PAIRS = Object.keys(SYMBOL_DISPLAY_MAP);

export default function MartingaleStrategyPage() {
  const [enabled, setEnabled] = useState(false);
  const [allocatedCapital, setAllocatedCapital] = useState('20.00');
  const [executionMode, setExecutionMode] = useState<'ONE_BY_ONE' | 'ALL_CONCURRENT'>('ONE_BY_ONE');
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
    allocatedCapital: 20.00
  });

  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchMartingaleData = async () => {
    try {
      const res = await fetch('/api/deriv/martingale');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setEnabled(Boolean(data.config.enabled));
          setAllocatedCapital(String(data.config.allocated_capital || '20.00'));
          setExecutionMode(data.config.execution_mode || 'ONE_BY_ONE');
          if (Array.isArray(data.config.selected_pairs)) {
            setSelectedPairs(data.config.selected_pairs);
          }
          if (Array.isArray(data.config.progression_steps) && data.config.progression_steps.length === 10) {
            setProgressionSteps(data.config.progression_steps.map((s: any) => String(s)));
          }
          if (Array.isArray(data.config.progression_active_steps) && data.config.progression_active_steps.length === 10) {
            setActiveSteps(data.config.progression_active_steps.map((b: any) => Boolean(b)));
          }
        }
        if (data.riskFilters) {
          setNewsFilterEnabled(data.riskFilters.news !== false);
          setSessionFilterEnabled(data.riskFilters.session !== false);
          setCooldownFilterEnabled(data.riskFilters.cooldown !== false);
          setDailyLimitEnabled(data.riskFilters.daily !== false);
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.recentTrades) {
          setRecentTrades(data.recentTrades);
        }
      }
    } catch (err) {
      console.error('Failed to load Martingale Strategy data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMartingaleData();
    const interval = setInterval(fetchMartingaleData, 10000);
    return () => clearInterval(interval);
  }, []);

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
      await fetch('/api/deriv/martingale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskFilters: {
            news,
            session,
            cooldown,
            daily
          }
        })
      });
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
          allocated_capital: parseFloat(allocatedCapital) || 20.00,
          execution_mode: executionMode,
          selected_pairs: selectedPairs,
          progression_steps: progressionSteps.map(s => parseFloat(s) || 0.35),
          progression_active_steps: activeSteps
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
        fetchMartingaleData();
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

  if (isLoading) {
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
            onClick={() => setEnabled(!enabled)}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Allocated Capital Pool</span>
          <div className="text-2xl font-black font-mono text-zinc-100 flex items-center gap-1">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>${parseFloat(allocatedCapital).toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-zinc-500">Dedicated budget pool for Martingale trades</p>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Martingale Total PnL</span>
          <div className={`text-2xl font-black font-mono ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
          </div>
          <p className="text-[10px] text-zinc-500">{stats.wonCount} Won / {stats.lostCount} Lost</p>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Execution Mode</span>
          <div className="text-lg font-black text-emerald-400 flex items-center gap-2">
            {executionMode === 'ONE_BY_ONE' ? <Lock className="w-4 h-4 text-emerald-400" /> : <Zap className="w-4 h-4 text-emerald-400" />}
            <span>{executionMode === 'ONE_BY_ONE' ? 'One-By-One' : 'Multi-Trade'}</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            {executionMode === 'ONE_BY_ONE' ? 'Waits for active trade to expire before next entry' : 'Parallel trades allowed'}
          </p>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-1">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Martingale Win Rate</span>
          <div className="text-2xl font-black font-mono text-zinc-100">
            {stats.winRate.toFixed(1)}%
          </div>
          <p className="text-[10px] text-zinc-500">Total {stats.totalTrades} Martingale trades executed</p>
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
            <p className="text-[10px] text-zinc-500">
              Only this pool will be tracked. Main strategy testing funds remain completely untouched.
            </p>
          </div>

          {/* Execution Mode Radio Cards */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <span>Trade Execution Mode</span>
              <span title="Controls single trade sequential locking vs multi-trade entries"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setExecutionMode('ONE_BY_ONE')}
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
                onClick={() => setExecutionMode('ALL_CONCURRENT')}
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
            return (
              <div
                key={idx}
                className={`border rounded-2xl p-3.5 space-y-2.5 transition-all ${
                  isChecked
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
                    <span className={`text-[11px] font-extrabold uppercase tracking-wide ${isChecked ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      Step {idx + 1}
                    </span>
                  </label>

                  {idx === 0 && (
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md">
                      RESET
                    </span>
                  )}
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
                      isChecked
                        ? 'bg-[#0c0c0f] border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 text-zinc-100'
                        : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
                    }`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] font-bold text-zinc-500">
                    USD
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progression Table Bottom Quick Save Bar */}
        <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4">
          <span className="text-xs text-zinc-400">
            Active Steps Enabled: <b>{activeSteps.filter(Boolean).length} / 10</b>
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold py-2 px-4 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Progression Table'}</span>
          </button>
        </div>
      </div>

      {/* Control 3: Dedicated Martingale Pair Selector */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-4 gap-3">
          <div>
            <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>Dedicated Martingale Scanned Pairs ({selectedPairs.length} Active)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Select any pairs dedicated for Martingale Strategy execution. You can select as many pairs as you want (no limit — click Select All or toggle individual pairs).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllPairs}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              Select All
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

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-72 overflow-y-auto pr-1">
          {ALL_AVAILABLE_PAIRS.map((pair) => {
            const isSelected = selectedPairs.includes(pair);
            const displayName = SYMBOL_DISPLAY_MAP[pair] || pair;
            return (
              <div
                key={pair}
                onClick={() => togglePair(pair)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-[#09090b]/60 border-zinc-800/80 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <span className="text-xs font-extrabold truncate pr-1">{displayName}</span>
                <CheckSquare className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-700'}`} />
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

      {/* Recent Martingale Trades History Table */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-zinc-200 border-b border-zinc-800/50 pb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-400" />
          <span>Recent Martingale Trades Execution Log</span>
        </h3>

        {recentTrades.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No Martingale trades executed yet. Enable Martingale Strategy Engine to start!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                  <th className="pb-3">Symbol</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Stake</th>
                  <th className="pb-3">PnL</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {recentTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/20">
                    <td className="py-3 font-bold text-zinc-100">{SYMBOL_DISPLAY_MAP[t.symbol] || t.symbol}</td>
                    <td className="py-3 font-bold">{t.contract_type}</td>
                    <td className="py-3">${(parseFloat(t.stake) || 0).toFixed(2)}</td>
                    <td className={`py-3 font-bold ${parseFloat(t.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {parseFloat(t.pnl) >= 0 ? '+' : ''}${parseFloat(t.pnl).toFixed(2)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        t.status === 'WON' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                        t.status === 'LOST' ? 'bg-rose-950 text-rose-400 border border-rose-500/30' :
                        'bg-amber-950 text-amber-400 border border-amber-500/30'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-500 text-[11px]">{new Date(t.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
