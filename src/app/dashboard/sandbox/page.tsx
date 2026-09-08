'use client';

import { useState, useEffect, useMemo } from 'react';
import { FileText, Calendar, ArrowUpRight, ArrowDownRight, Layers, HelpCircle, DollarSign, TrendingUp, Percent, Trophy, Shield, Activity, Sliders, CheckSquare } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DerivTrade {
  id: string;
  contract_id?: string;
  timestamp: string;
  symbol: string;
  contract_type: 'CALL' | 'PUT' | 'BUY' | 'SELL';
  purchase_price: number;
  payout: number;
  status: 'OPEN' | 'CLOSED' | 'WON' | 'LOST';
  pnl: number;
  closed_at?: string;
  strategy?: string;
  barrier?: string;
}

const DERIV_STRATEGIES = [
  { id: 'FOREX_15M_MTF', name: 'Forex Major Pairs (15M MTF)', desc: 'RSI + EMA Trend Pullback for EURUSD, GBPUSD, USDJPY', mode: 'LIVE' },
  { id: 'DERIV_INDEX_5M', name: 'Volatility Indices (5M)', desc: 'High-Speed Volatility Breakout for R_10 to R_100 & Volatility 10s-100s', mode: 'SANDBOX' },
  { id: 'DERIV_OPTION_30M', name: 'Deriv Options (30M)', desc: 'Higher Timeframe Reversion & Range Breakout Engine', mode: 'SANDBOX' },
];

const DEFAULT_DERIV_PAIRS = [
  'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY',
  'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
  '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'
];

export default function DerivSandboxPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trades, setTrades] = useState<DerivTrade[]>([]);
  const [activeTrades, setActiveTrades] = useState<DerivTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [selectedStrategy, setSelectedStrategy] = useState<string>('FOREX_15M_MTF');
  const [derivSettings, setDerivSettings] = useState<any>(null);
  const [isTogglingBot, setIsTogglingBot] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(DEFAULT_DERIV_PAIRS);

  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    setStartDate(formatDateStr(sevenDaysAgo));
    setEndDate(formatDateStr(today));
  }, []);

  const fetchSandboxData = async () => {
    setIsLoading(true);
    try {
      const [resSettings, resTrades] = await Promise.all([
        fetch('/api/deriv/settings'),
        fetch('/api/deriv/trades')
      ]);

      const dataSettings = await resSettings.json();
      const dataTrades = await resTrades.json();

      if (resSettings.ok && dataSettings.success) {
        setDerivSettings(dataSettings);
        if (dataSettings.derivSelectedPairs && Array.isArray(dataSettings.derivSelectedPairs)) {
          setSelectedPairs(dataSettings.derivSelectedPairs);
        }
      }

      if (resTrades.ok && dataTrades.success) {
        const rawTrades: DerivTrade[] = (dataTrades.trades || []).map((t: any) => ({
          id: String(t.id || t.contract_id || Math.random()),
          contract_id: String(t.contract_id || ''),
          timestamp: t.timestamp || t.created_at || new Date().toISOString(),
          symbol: t.symbol || t.pair || 'frxEURUSD',
          contract_type: t.contract_type === 'CALL' || t.direction === 'LONG' ? 'CALL' : 'PUT',
          purchase_price: parseFloat(t.purchase_price || t.amount || 1.0),
          payout: parseFloat(t.payout || 0.0),
          status: t.status === 'CLOSED' || t.status === 'WON' || t.status === 'LOST' ? 'CLOSED' : 'OPEN',
          pnl: parseFloat(t.pnl || 0.0),
          closed_at: t.closed_at || t.timestamp,
          strategy: t.strategy || 'FOREX_15M_MTF',
          barrier: t.barrier || ''
        }));

        setTrades(rawTrades.filter((t) => t.status === 'CLOSED'));
        setActiveTrades(rawTrades.filter((t) => t.status === 'OPEN'));
      }
    } catch (err) {
      console.error('Failed to load Deriv sandbox data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSandboxData();
  }, []);

  const handleToggleBot = async () => {
    if (!derivSettings) return;
    const newStatus = !derivSettings.botEnabled;
    setIsTogglingBot(true);
    try {
      const res = await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botEnabled: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDerivSettings((prev: any) => ({ ...prev, botEnabled: newStatus }));
        setStatusMsg({
          type: 'success',
          text: `Deriv Sandbox Engine is now ${newStatus ? 'ENABLED (RUNNING)' : 'DISABLED (PAUSED)'}`
        });
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to update Deriv bot status.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsTogglingBot(false);
    }
  };

  const filteredClosedTrades = useMemo(() => {
    return trades.filter((t) => {
      if (selectedStrategy && t.strategy && t.strategy !== selectedStrategy) return false;
      if (!startDate || !endDate) return true;
      const tradeDate = new Date(t.timestamp).toISOString().split('T')[0];
      return tradeDate >= startDate && tradeDate <= endDate;
    });
  }, [trades, selectedStrategy, startDate, endDate]);

  const stats = useMemo(() => {
    const totalCount = filteredClosedTrades.length;
    const wins = filteredClosedTrades.filter((t) => t.pnl > 0).length;
    const losses = filteredClosedTrades.filter((t) => t.pnl < 0).length;
    const winRate = totalCount > 0 ? (wins / totalCount) * 100 : 0;
    const totalPnl = filteredClosedTrades.reduce((sum, t) => sum + t.pnl, 0);

    return { totalCount, wins, losses, winRate, totalPnl };
  }, [filteredClosedTrades]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading Deriv Strategy Sandbox...</p>
      </div>
    );
  }

  const isBotRunning = Boolean(derivSettings?.botEnabled);
  const tradingMode = derivSettings?.tradingMode || 'DEMO';
  const demoBalance = derivSettings?.demoBalance || 10000.00;

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-4">
      {/* Top Banner Engine Controller */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="flex h-4 w-4 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBotRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`relative inline-flex rounded-full h-4 w-4 ${isBotRunning ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-zinc-100">Deriv Strategy Sandbox</h2>
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                tradingMode === 'REAL' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-amber-950/40 border-amber-800 text-amber-400'
              }`}>
                {tradingMode === 'REAL' ? 'REAL LIVE' : 'DEMO SANDBOX'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Simulate &amp; backtest Deriv Options contracts (Forex Majors &amp; Volatility Indices) in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Deriv Practice Balance</span>
            <span className="text-lg font-mono font-bold text-emerald-400">${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
          </div>

          <button
            type="button"
            disabled={isTogglingBot}
            onClick={handleToggleBot}
            className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 ${
              isBotRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{isTogglingBot ? 'Updating...' : isBotRunning ? 'Pause Engine' : 'Start Engine'}</span>
          </button>
        </div>
      </div>

      {statusMsg.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold ${statusMsg.type === 'success' ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border border-red-900/50 text-red-400'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Main Grid: Strategy Selector & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Strategy Tabs */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Active Deriv Engines</span>
          </h3>

          <div className="space-y-3">
            {DERIV_STRATEGIES.map((strat) => {
              const isSelected = selectedStrategy === strat.id;
              return (
                <div
                  key={strat.id}
                  onClick={() => setSelectedStrategy(strat.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 shadow-md'
                      : 'bg-[#0c0c0f]/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold">{strat.name}</span>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                      {strat.mode}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{strat.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Deriv Scanned Asset Pairs list */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tracked Deriv Pairs</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedPairs.map((pair) => (
                <span key={pair} className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-mono text-zinc-300 font-bold">
                  {pair}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Performance Analytics & Trade Ledger */}
        <div className="lg:col-span-8 space-y-6">
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#0c0c0f]/60 border border-zinc-800/80 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Strategy Win Rate</span>
              <span className="text-xl font-mono font-extrabold text-emerald-400">{stats.winRate.toFixed(1)}%</span>
              <span className="text-[10px] text-zinc-500 block mt-1">{stats.wins} Wins / {stats.losses} Losses</span>
            </div>

            <div className="bg-[#0c0c0f]/60 border border-zinc-800/80 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Total Realized P&amp;L</span>
              <span className={`text-xl font-mono font-extrabold ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">{stats.totalCount} Total Trades</span>
            </div>

            <div className="bg-[#0c0c0f]/60 border border-zinc-800/80 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Active Open Contracts</span>
              <span className="text-xl font-mono font-extrabold text-blue-400">{activeTrades.length}</span>
              <span className="text-[10px] text-zinc-500 block mt-1">Live in Deriv Engine</span>
            </div>

            <div className="bg-[#0c0c0f]/60 border border-zinc-800/80 p-4 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Default Stake</span>
              <span className="text-xl font-mono font-extrabold text-zinc-200">${derivSettings?.derivStakeAmount || '1.00'}</span>
              <span className="text-[10px] text-zinc-500 block mt-1">Per Binary Contract</span>
            </div>
          </div>

          {/* Date Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0c0c0f]/40 border border-zinc-800/80 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none"
              />
              <span className="text-xs text-zinc-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={fetchSandboxData}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Refresh Data
            </button>
          </div>

          {/* Active Open Positions Section */}
          {activeTrades.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>Active Floating Contracts ({activeTrades.length})</span>
              </h4>

              <div className="space-y-2">
                {activeTrades.map((trade) => (
                  <div key={trade.id} className="p-4 bg-blue-950/15 border border-blue-900/40 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-zinc-200">{trade.symbol}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${trade.contract_type === 'CALL' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                          {trade.contract_type}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">Contract ID: {trade.contract_id || trade.id}</span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-zinc-300 block">${trade.purchase_price.toFixed(2)} Stake</span>
                      <span className="text-[10px] text-blue-400 font-bold">Running...</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Closed Trades Table */}
          <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Completed Deriv Trade Ledger</span>
            </h4>

            {filteredClosedTrades.length === 0 ? (
              <div className="p-8 border border-dashed border-zinc-800/80 rounded-2xl text-center text-zinc-500 text-xs">
                No completed Deriv trades found for the selected date range.
              </div>
            ) : (
              <div className="overflow-x-auto border border-zinc-800/60 rounded-2xl bg-zinc-950/20">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="p-3">Time</th>
                      <th className="p-3">Asset Symbol</th>
                      <th className="p-3">Contract</th>
                      <th className="p-3 text-right">Stake Price</th>
                      <th className="p-3 text-right">Net P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredClosedTrades.map((t) => (
                      <tr key={t.id} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="p-3 text-[10px] font-mono text-zinc-400">
                          {new Date(t.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                        </td>
                        <td className="p-3 font-bold text-zinc-200 font-mono">{t.symbol}</td>
                        <td className="p-3 font-mono">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${t.contract_type === 'CALL' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-red-950/50 text-red-400'}`}>
                            {t.contract_type}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">${t.purchase_price.toFixed(2)}</td>
                        <td className={`p-3 text-right font-mono font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
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
