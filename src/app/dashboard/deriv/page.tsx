'use client';

import React, { useState, useEffect } from 'react';
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
  { id: 'FOREX_15M_MTF', name: 'Forex 15m MTF Crossover', desc: 'H1 Trend Filter + 15m EMA/ADX + 5m Stochastic crossover entry trigger.' }
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

  // Strategy list selectors
  const [activeStrategies, setActiveStrategies] = useState<string[]>(['FOREX_15M_MTF']);
  const [draftStrategies, setDraftStrategies] = useState<string[]>(['FOREX_15M_MTF']);
  const [isSavingStrategies, setIsSavingStrategies] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    fetchSettings();
    fetchTrades();

    const interval = setInterval(() => {
      syncTradesSilently();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
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
        setDraftStrategies(activeStrats);
        setDashboardMaxTrades(String(data.derivMaxTrades || 10));
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
          activeStrategies
        }),
      });

      fetchSettings();
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
          derivMaxTrades: parseInt(dashboardMaxTrades)
        }),
      });

      if (res.ok) {
        setActiveStrategies(draftStrategies);
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
          derivMaxTrades: parseInt(dashboardMaxTrades)
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
          derivMaxTrades: parseInt(dashboardMaxTrades)
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

  const hasUnsavedStrategies = JSON.stringify(activeStrategies.sort()) !== JSON.stringify(draftStrategies.sort());
  const filteredStrategies = STRATEGIES_LIST.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
          
          {/* Strategy Checklist (Matches Binance layout) */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-4 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">Active Engines</h3>
              <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                Tick to run on Deriv, untick to pause.
              </p>
            </div>

            <div>
              <input
                type="text"
                placeholder="🔍 Search strategy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {filteredStrategies.map((strat) => {
                const isTicked = draftStrategies.includes(strat.id);
                const isSelected = activeStrategies.includes(strat.id);
                return (
                  <div
                    key={strat.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-200 text-[10px] font-bold ${
                      isSelected
                        ? 'bg-emerald-950/20 text-emerald-400 font-extrabold border border-emerald-500/10'
                        : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                    }`}
                  >
                    <span className="flex-1 uppercase tracking-wider font-mono truncate mr-2">
                      {strat.name}
                    </span>
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isTicked}
                        onChange={() => handleToggleStrategyDraft(strat.id)}
                        className="w-3.5 h-3.5 border border-zinc-700 rounded bg-zinc-950 checked:bg-emerald-500 checked:border-emerald-500 focus:outline-none transition-all cursor-pointer accent-emerald-500"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            {hasUnsavedStrategies && (
              <div className="pt-2 border-t border-zinc-800/60">
                <button
                  onClick={handleSaveActiveStrategies}
                  disabled={isSavingStrategies}
                  className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-all duration-300 shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  {isSavingStrategies ? 'Saving...' : 'Save Configuration'}
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
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
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
                      body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode, botEnabled: true, activeStrategies })
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
                      body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode, botEnabled: false, activeStrategies })
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
                      body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode: 'DEMO', botEnabled: derivBotEnabled, activeStrategies })
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
                      body: JSON.stringify({ appId, apiToken, demoAccount, realAccount, tradingMode: 'REAL', botEnabled: derivBotEnabled, activeStrategies })
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
                        <td className="py-3.5 text-zinc-200 text-xs">{t.symbol}</td>
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
                          <td className="py-3.5 text-zinc-300 text-xs">{t.symbol}</td>
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
