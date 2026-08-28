'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Settings,
  RefreshCw,
  Loader2,
  Save,
  CheckCircle,
  AlertTriangle,
  Play,
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

export default function DerivDashboard() {
  const [appId, setAppId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [demoAccount, setDemoAccount] = useState('');
  const [realAccount, setRealAccount] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' });

  // Trades state
  const [trades, setTrades] = useState<DerivTrade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Manual trade form state
  const [tradeSymbol, setTradeSymbol] = useState('1HZ100V'); // Volatility 100 (1s) Index
  const [tradeType, setTradeType] = useState<'CALL' | 'PUT'>('CALL');
  const [tradeAmount, setTradeAmount] = useState('8.00');
  const [tradeDuration, setTradeDuration] = useState('60');
  const [tradeDurationUnit, setTradeDurationUnit] = useState('s'); // s = seconds, m = minutes
  const [tradeMode, setTradeMode] = useState<'DEMO' | 'REAL'>('DEMO');
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);

  // Load settings and trades on mount
  useEffect(() => {
    fetchSettings();
    fetchTrades();

    // Auto-refresh trades every 10 seconds to keep live contracts synced
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
        setAppId(data.appId);
        setApiToken(data.apiToken);
        setDemoAccount(data.demoAccount);
        setRealAccount(data.realAccount);
        if (data.isFallback) {
          setSettingsMessage({
            type: 'warning',
            text: 'Settings loaded from env.local file defaults.',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching Deriv settings:', err);
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
      console.error('Error fetching Deriv trades:', err);
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
        // Find if any previously OPEN trade just got WON
        const previousOpenIds = trades.filter(t => t.status === 'OPEN').map(t => t.id);
        const newTrades: DerivTrade[] = data.trades || [];
        
        newTrades.forEach(nt => {
          if (previousOpenIds.includes(nt.id) && nt.status === 'WON') {
            confetti({
              particleCount: 100,
              spread: 60,
              origin: { y: 0.8 },
              colors: ['#10b981', '#34d399', '#6ee7b7']
            });
          }
        });

        setTrades(newTrades);
      }
    } catch (err) {
      console.error('Error syncing trades:', err);
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
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSettingsMessage({
          type: 'success',
          text: 'Deriv credentials saved to Supabase settings successfully!',
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
        text: err.message || 'Error occurred while saving.',
      });
    } finally {
      setIsSavingSettings(false);
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
        alert(`🎉 Contract purchased successfully!\nContract ID: ${data.trade.contract_id}`);
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
    const confirm = window.confirm("Are you sure you want to CLOSE and archive all simulated Deriv trades in the database?");
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800/80 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-100 flex items-center gap-2.5">
            <LineChart className="w-7 h-7 text-emerald-400" />
            <span>Deriv Options Dashboard</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Execute binary options Rise/Fall proposals and monitor live contract status streams in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTrades}
            disabled={isLoadingTrades || isSyncing}
            className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-850 hover:text-emerald-400 text-zinc-400 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="Refresh Account Data"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing || isLoadingTrades ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Account PnL & Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-900/60 flex items-center justify-center text-emerald-400 border border-zinc-850">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Simulation P&L</span>
            <span className={`text-xl font-black font-mono mt-1 block ${totalSimulatedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalSimulatedPnl >= 0 ? '+' : ''}{totalSimulatedPnl.toFixed(2)} USD
            </span>
          </div>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-900/60 flex items-center justify-center text-blue-400 border border-zinc-850">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Simulated Win Rate</span>
            <span className="text-xl font-black font-mono mt-1 text-zinc-200 block">
              {winRate.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-2xl flex items-center gap-4 sm:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-zinc-900/60 flex items-center justify-center text-purple-400 border border-zinc-850">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Active Positions</span>
            <span className="text-xl font-black font-mono mt-1 text-zinc-200 block">
              {openTrades.length} Contract(s)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Manual trade execution and credentials configuration */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card 1: Trade execution widget */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-wider">
              <Play className="w-4 h-4 text-emerald-400" />
              <span>Buy Options Proposal</span>
            </h3>

            <form onSubmit={handleExecuteTrade} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Asset Symbol</label>
                <select
                  value={tradeSymbol}
                  onChange={(e) => setTradeSymbol(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 outline-none focus:border-zinc-700 cursor-pointer"
                >
                  <option value="1HZ100V">Volatility 100 (1s) Index (Continuous)</option>
                  <option value="1HZ50V">Volatility 50 (1s) Index</option>
                  <option value="frxEURUSD">EUR/USD (Forex - Min 15m)</option>
                  <option value="cryBTCUSD">Bitcoin Index (Crypto)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Direction</label>
                  <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTradeType('CALL')}
                      className={`flex-1 py-1 rounded-lg text-xs font-black transition-all ${
                        tradeType === 'CALL' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500'
                      }`}
                    >
                      Rise (CALL)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeType('PUT')}
                      className={`flex-1 py-1 rounded-lg text-xs font-black transition-all ${
                        tradeType === 'PUT' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-zinc-500'
                      }`}
                    >
                      Fall (PUT)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Account Type</label>
                  <select
                    value={tradeMode}
                    onChange={(e) => setTradeMode(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    <option value="DEMO">Demo account</option>
                    <option value="REAL">Real account</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Stake ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Duration</label>
                  <input
                    type="number"
                    value={tradeDuration}
                    onChange={(e) => setTradeDuration(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  />
                </div>

                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Unit</label>
                  <select
                    value={tradeDurationUnit}
                    onChange={(e) => setTradeDurationUnit(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 outline-none focus:border-zinc-700 cursor-pointer"
                  >
                    <option value="s">Seconds</option>
                    <option value="m">Minutes</option>
                    <option value="t">Ticks</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isExecutingTrade}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isExecutingTrade ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <span>Purchase Contract</span>
                )}
              </button>
            </form>
          </div>

          {/* Card 2: Credentials Settings Configuration */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-wider">
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Deriv Authentication</span>
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">App ID</label>
                <input
                  type="text"
                  placeholder="e.g. 34eMOq..."
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">API Token (PAT)</label>
                <input
                  type="password"
                  placeholder="pat_..."
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Demo ID</label>
                  <input
                    type="text"
                    placeholder="DOT..."
                    value={demoAccount}
                    onChange={(e) => setDemoAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Real ID</label>
                  <input
                    type="text"
                    placeholder="ROT..."
                    value={realAccount}
                    onChange={(e) => setRealAccount(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                  />
                </div>
              </div>

              {settingsMessage.text && (
                <div className={`p-2.5 rounded-xl text-[10px] font-semibold flex items-start gap-1.5 border ${
                  settingsMessage.type === 'success'
                    ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                    : settingsMessage.type === 'warning'
                    ? 'bg-amber-950/20 border-amber-900/50 text-amber-500'
                    : 'bg-red-950/20 border-red-900/50 text-red-400'
                }`}>
                  {settingsMessage.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{settingsMessage.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSavingSettings ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save credentials</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Active contracts list and past history */}
        <div className="lg:col-span-2 space-y-6">
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
                <p className="text-xs text-zinc-500 font-medium font-semibold">No recent contracts in history</p>
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
