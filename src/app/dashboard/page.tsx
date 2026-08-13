'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Square,
  TrendingUp,
  Percent,
  Layers,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  History as HistoryIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Stats {
  botEnabled: boolean;
  balance: number;
  balanceFetched: boolean;
  balanceError: string;
  todayPnl: number;
  winRate: number;
  openTradesCount: number;
}

interface Trade {
  id: string;
  timestamp: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  amount: number;
  tp_price: number;
  sl_price: number;
  status: 'OPEN' | 'CLOSED';
  pnl: number | null;
  closed_at: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingBot, setIsTogglingBot] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();

      const tradesRes = await fetch('/api/trades');
      const tradesData = await tradesRes.json();

      if (statsData.success) {
        setStats(statsData);
      }
      if (tradesData.success) {
        const allTrades: Trade[] = tradesData.trades || [];
        setActiveTrades(allTrades.filter((t) => t.status === 'OPEN'));
        setRecentTrades(allTrades.filter((t) => t.status === 'CLOSED').slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleBot = async () => {
    if (!stats || isTogglingBot) return;
    setIsTogglingBot(true);
    const newStatus = !stats.botEnabled;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_enabled: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStats((prev) => (prev ? { ...prev, botEnabled: newStatus } : null));
        if (newStatus) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#06b6d4'],
          });
        }
      }
    } catch (err) {
      console.error('Failed to toggle bot status:', err);
    } finally {
      setIsTogglingBot(false);
    }
  };

  const closePosition = async (tradeId: string, isProfitable: boolean) => {
    if (closingTradeId) return;
    setClosingTradeId(tradeId);

    try {
      const res = await fetch('/api/trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (isProfitable) {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#10b981', '#059669', '#34d399'],
          });
        }
        fetchDashboardData();
      } else {
        alert(data.error || 'Failed to close trade.');
      }
    } catch (err) {
      console.error(err);
      alert('Error closing position.');
    } finally {
      setClosingTradeId(null);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading VIP Terminal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome & Global Toggle Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">VIP Dashboard</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time Binance Testnet engine tracker.
          </p>
        </div>

        {/* Bot Toggle Switch */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-wider uppercase text-zinc-400">
            Engine State:
          </span>
          <button
            onClick={toggleBot}
            disabled={isTogglingBot}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-md ${
              stats?.botEnabled
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
            }`}
          >
            {stats?.botEnabled ? (
              <>
                <Play className="w-4 h-4 fill-white animate-pulse" />
                <span>BOT RUNNING</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 fill-zinc-400" />
                <span>BOT STOPPED</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Balance */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Live Balance
            </span>
            <span className="p-2 bg-blue-950/30 border border-blue-900/50 rounded-xl text-blue-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-zinc-100">
              {stats?.balance.toFixed(2)}
              <span className="text-sm font-medium text-zinc-500 ml-1.5">USDT</span>
            </h3>
            {stats?.balanceError && (
              <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Default loaded (API check settings)</span>
              </p>
            )}
          </div>
        </div>

        {/* Card 2: Today's P&L */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Today P&L
            </span>
            <span
              className={`p-2 rounded-xl border ${
                (stats?.todayPnl || 0) >= 0
                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                  : 'bg-red-950/30 border-red-900/50 text-red-400'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3
              className={`text-3xl font-extrabold tracking-tight ${
                (stats?.todayPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {(stats?.todayPnl || 0) >= 0 ? '+' : ''}
              {stats?.todayPnl.toFixed(2)}
              <span className="text-sm font-medium text-zinc-500 ml-1.5">USDT</span>
            </h3>
            <p className="text-[10px] text-zinc-500 mt-2 font-medium">Daily profit accumulation</p>
          </div>
        </div>

        {/* Card 3: Win Rate */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Win Rate %
            </span>
            <span className="p-2 bg-purple-950/30 border border-purple-900/50 rounded-xl text-purple-400">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-purple-400">
              {stats?.winRate.toFixed(1)}%
            </h3>
            <p className="text-[10px] text-zinc-500 mt-2 font-medium">Of completed operations</p>
          </div>
        </div>

        {/* Card 4: Open Positions */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Active Positions
            </span>
            <span className="p-2 bg-amber-950/30 border border-amber-900/50 rounded-xl text-amber-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight text-amber-400">
              {stats?.openTradesCount}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-2 font-medium">Running on Binance Futures</p>
          </div>
        </div>
      </div>

      {/* Grid: Open Positions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Open Positions List */}
        <div className="lg:col-span-2 bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-zinc-200">Active Positions</h3>
              <button
                onClick={fetchDashboardData}
                className="p-1.5 hover:bg-zinc-800/60 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {activeTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800/80 rounded-2xl">
                <Layers className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-500 font-medium">No active positions open</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="pb-3">Pair</th>
                      <th className="pb-3 text-center">Direction</th>
                      <th className="pb-3 text-right">Entry Price</th>
                      <th className="pb-3 text-right">SL / TP</th>
                      <th className="pb-3 text-right">Amount</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-sm">
                    {activeTrades.map((trade) => (
                      <tr key={trade.id} className="group">
                        <td className="py-4 font-bold text-zinc-200">{trade.pair}</td>
                        <td className="py-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${
                              trade.direction === 'LONG'
                                ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                                : 'bg-red-950/20 border-red-900/50 text-red-400'
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-4 text-right font-mono font-medium">
                          {trade.entry_price.toFixed(4)}
                        </td>
                        <td className="py-4 text-right text-xs space-y-0.5">
                          <div className="font-mono text-red-400/80 font-medium">
                            SL: {trade.sl_price.toFixed(4)}
                          </div>
                          <div className="font-mono text-emerald-400/80 font-medium">
                            TP: {trade.tp_price.toFixed(4)}
                          </div>
                        </td>
                        <td className="py-4 text-right font-mono font-medium text-zinc-300">
                          {trade.amount}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => closePosition(trade.id, true)}
                            disabled={closingTradeId === trade.id}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                            title="Force Manual Close"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Trade Logs */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-zinc-200 mb-6">Recent Completed Trades</h3>

          {recentTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800/80 rounded-2xl">
              <HistoryIcon className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-500 font-medium">No trade history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTrades.map((trade) => {
                const pnl = trade.pnl || 0;
                const isWin = pnl >= 0;
                return (
                  <div
                    key={trade.id}
                    className="flex justify-between items-center p-3 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-800/50 rounded-2xl transition-all duration-200"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-200">{trade.pair}</span>
                        <span
                          className={`text-[9px] font-bold px-1 py-0.2 rounded border uppercase ${
                            trade.direction === 'LONG'
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                              : 'bg-red-950/20 border-red-900/50 text-red-400'
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        {trade.closed_at ? new Date(trade.closed_at).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-sm font-bold flex items-center justify-end gap-0.5 ${
                          isWin ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isWin ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span>
                          {isWin ? '+' : ''}
                          {pnl.toFixed(2)} USDT
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Exit: {trade.exit_price?.toFixed(4)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
