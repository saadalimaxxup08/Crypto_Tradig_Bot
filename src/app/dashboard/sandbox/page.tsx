'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, Calendar, Download, Send, ArrowUpRight, ArrowDownRight, Layers, HelpCircle } from 'lucide-react';

interface Trade {
  id: string;
  timestamp: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number;
  amount: number;
  status: 'OPEN' | 'CLOSED';
  pnl: number;
  closed_at: string;
  leverage: number;
  margin: number;
  strategy?: string;
  is_paper?: boolean;
}

export default function SandboxPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [hourlyFilter, setHourlyFilter] = useState<'none' | '1h' | '3h' | '6h' | '12h'>('none');
  const [selectedStrategy, setSelectedStrategy] = useState<'RSI_MACD' | 'BOLLINGER_RSI' | 'DOUBLE_EMA'>('BOLLINGER_RSI');
  const [activeStrategySetting, setActiveStrategySetting] = useState('RSI_MACD');
  const [allRawTrades, setAllRawTrades] = useState<Trade[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Default date ranges setup (Last 7 days)
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    setStartDate(formatDateStr(sevenDaysAgo));
    setEndDate(formatDateStr(today));
  }, []);

  const applyFilters = (allTrades: Trade[], activeStrat = activeStrategySetting) => {
    // Filter paper trades for the selected strategy
    const isTabPaper = selectedStrategy !== activeStrat;
    const strategyTrades = allTrades.filter((t) => 
      (t.strategy || 'RSI_MACD') === selectedStrategy && 
      (isTabPaper ? t.is_paper === true : !t.is_paper)
    );

    // Filter by date range or hourly range
    const filteredClosed = strategyTrades.filter((t) => {
      if (t.status !== 'CLOSED' || !t.closed_at) return false;
      const closedTime = new Date(t.closed_at);
      
      if (hourlyFilter !== 'none') {
        const hours = hourlyFilter === '1h' ? 1 : hourlyFilter === '3h' ? 3 : hourlyFilter === '6h' ? 6 : 12;
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return closedTime >= cutoff;
      } else {
        const startBoundary = new Date(startDate);
        startBoundary.setHours(0, 0, 0, 0);

        const endBoundary = new Date(endDate);
        endBoundary.setHours(23, 59, 59, 999);
        return closedTime >= startBoundary && closedTime <= endBoundary;
      }
    });

    // Sort ascending by close time
    filteredClosed.sort((a, b) => new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime());
    setTrades(filteredClosed);

    // Filter active trades
    const active = strategyTrades.filter((t) => t.status === 'OPEN');
    setActiveTrades(active);
  };

  const fetchSandboxTrades = async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      // 1. Fetch active strategy setting
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();
      let currentActiveStrategy = 'RSI_MACD';
      if (settingsRes.ok && settingsData.active_strategy) {
        currentActiveStrategy = settingsData.active_strategy;
        setActiveStrategySetting(currentActiveStrategy);
      }

      // 2. Fetch all trades
      const res = await fetch('/api/trades');
      const data = await res.json();
      if (res.ok && data.success) {
        const allTrades: Trade[] = data.trades || [];
        setLivePrices(data.livePrices || {});
        setAllRawTrades(allTrades);
        applyFilters(allTrades, currentActiveStrategy);
      }
    } catch (err) {
      console.error('Failed to load sandbox trades:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (allRawTrades.length > 0) {
      applyFilters(allRawTrades);
    }
  }, [selectedStrategy, startDate, endDate, hourlyFilter, activeStrategySetting]);

  useEffect(() => {
    fetchSandboxTrades();
  }, [startDate, endDate, hourlyFilter]);

  // Binance WebSocket connection for active trades (Live Floating P&L updates)
  useEffect(() => {
    if (activeTrades.length === 0) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const symbols = activeTrades.map((t) => t.pair).sort();
    const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join('/');
    const wsUrl = `wss://fstream.binance.com/stream?streams=${streams}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!message.data) return;

        const symbol = message.data.s;
        const closePrice = parseFloat(message.data.c);

        if (symbol && !isNaN(closePrice)) {
          setLivePrices((prev) => ({ ...prev, [symbol]: closePrice }));
        }
      } catch (err) {
        console.error('Error parsing live price in sandbox:', err);
      }
    };

    ws.onclose = () => {
      console.log('Sandbox WS closed');
    };

    return () => {
      ws.close();
    };
  }, [activeTrades.map(t => t.pair).sort().join(',')]);

  // Set quick ranges
  const setRangeQuick = (rangeType: 'today' | 'yesterday' | 'week' | 'month') => {
    setHourlyFilter('none');
    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    if (rangeType === 'today') {
      setStartDate(formatDateStr(today));
      setEndDate(formatDateStr(today));
    } else if (rangeType === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      setStartDate(formatDateStr(yesterday));
      setEndDate(formatDateStr(yesterday));
    } else if (rangeType === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      setStartDate(formatDateStr(weekAgo));
      setEndDate(formatDateStr(today));
    } else if (rangeType === 'month') {
      const monthAgo = new Date();
      monthAgo.setDate(today.getDate() - 30);
      setStartDate(formatDateStr(monthAgo));
      setEndDate(formatDateStr(today));
    }
  };

  const setRangeHourly = (filter: '1h' | '3h' | '6h' | '12h') => {
    setHourlyFilter(filter);
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  };

  // Compile calculations
  const totalTrades = trades.length;
  const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  // Realized Net P&L (closed trades in range)
  const realizedNetPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  // Total Floating P&L (open trades in this strategy)
  const totalFloatingPnl = activeTrades.reduce((sum, t) => {
    const curPrice = livePrices[t.pair] || t.entry_price;
    return sum + ((curPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1));
  }, 0);

  // Total P&L = Realized P&L + Floating P&L
  const totalPnl = realizedNetPnl + totalFloatingPnl;
  const currentBalance = 100.0 + totalPnl;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Strategy Testing Sandbox</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Compare win-rates and simulated balances across independent trading strategies.
          </p>
        </div>
      </div>

      {/* Strategy Selection Tabs */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-850 pb-3">
        <button
          onClick={() => setSelectedStrategy('RSI_MACD')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
            selectedStrategy === 'RSI_MACD'
              ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
              : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
          }`}
        >
          <span>📊 RSI + MACD</span>
          <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'RSI_MACD' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
            {activeStrategySetting === 'RSI_MACD' ? 'LIVE' : 'SANDBOX'}
          </span>
        </button>

        <button
          onClick={() => setSelectedStrategy('BOLLINGER_RSI')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
            selectedStrategy === 'BOLLINGER_RSI'
              ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
              : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
          }`}
        >
          <span>↕️ Bollinger + RSI</span>
          <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'BOLLINGER_RSI' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
            {activeStrategySetting === 'BOLLINGER_RSI' ? 'LIVE' : 'SANDBOX'}
          </span>
        </button>

        <button
          onClick={() => setSelectedStrategy('DOUBLE_EMA')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
            selectedStrategy === 'DOUBLE_EMA'
              ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
              : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
          }`}
        >
          <span>🎢 Double EMA</span>
          <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'DOUBLE_EMA' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
            {activeStrategySetting === 'DOUBLE_EMA' ? 'LIVE' : 'SANDBOX'}
          </span>
        </button>
      </div>

      {/* Date Pickers & Quick Filters */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Custom Date Pickers */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Start Date</span>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setHourlyFilter('none');
                  }}
                  className="bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">End Date</span>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setHourlyFilter('none');
                  }}
                  className="bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500 rounded-xl py-2 px-3 text-xs text-zinc-200 font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Buttons Grid */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRangeQuick('today')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === 'none' && startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('yesterday')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === 'none' && startDate === new Date(Date.now() - 86400000).toISOString().split('T')[0] && endDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('week')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === 'none' && startDate === new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('month')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === 'none' && startDate === new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 30 Days
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRangeHourly('1h')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === '1h'
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last Hour
              </button>
              <button
                type="button"
                onClick={() => setRangeHourly('3h')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === '3h'
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 3 Hours
              </button>
              <button
                type="button"
                onClick={() => setRangeHourly('6h')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === '6h'
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 6 Hours
              </button>
              <button
                type="button"
                onClick={() => setRangeHourly('12h')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === '12h'
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 12 Hours
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Trades */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Trades</span>
          <h3 className="text-2xl font-extrabold text-zinc-200 mt-2">{totalTrades}</h3>
          <p className="text-[9px] text-zinc-500 mt-1">Closed paper positions</p>
        </div>

        {/* Win Rate */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-purple-400">Win Rate %</span>
          <h3 className="text-2xl font-extrabold text-purple-400 mt-2">{winRate.toFixed(1)}%</h3>
          <p className="text-[9px] text-zinc-500 mt-1">Wins: {wins} | Losses: {losses}</p>
        </div>

        {/* Sandbox Wallet Balance */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Total P&L</span>
          <h3 className={`text-2xl font-extrabold mt-2 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}
            {totalPnl.toFixed(4)}
            <span className="text-xs font-medium ml-1">USDT</span>
          </h3>
          <p className="text-[9px] text-zinc-500 mt-1">
            {selectedStrategy !== activeStrategySetting 
              ? `Balance: ${currentBalance.toFixed(2)} USDT (Starts: 100)`
              : `Balance: ${currentBalance.toFixed(2)} USDT (Live Baseline)`}
          </p>
        </div>

        {/* Daily P&L */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden">
          {(() => {
            const startOfToday = new Date();
            startOfToday.setUTCHours(0, 0, 0, 0);
            const dailyPnl = trades
              .filter((t) => t.closed_at && new Date(t.closed_at) >= startOfToday)
              .reduce((sum, t) => sum + (t.pnl || 0), 0);
            return (
              <>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Daily P&L</span>
                <h3 className={`text-2xl font-extrabold mt-2 ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyPnl >= 0 ? '+' : ''}
                  {dailyPnl.toFixed(4)}
                  <span className="text-xs font-medium ml-1">USDT</span>
                </h3>
                <p className="text-[9px] text-zinc-500 mt-1">Closed trades closed today</p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Active Running Positions Section */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
        <h3 className="text-md font-bold text-zinc-200 pb-2 border-b border-zinc-800/50 flex items-center justify-between">
          <span>Active Running Positions (Paper Sandbox)</span>
          <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400">
            {activeTrades.length} positions
          </span>
        </h3>

        {activeTrades.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-zinc-950/20 border border-zinc-800/60 rounded-2xl">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Total Margin Used</span>
              <div className="text-sm font-extrabold text-zinc-200">
                {activeTrades.reduce((sum, t) => sum + (t.margin || 1.0), 0).toFixed(2)} <span className="text-[10px] font-medium text-zinc-400">USDT</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Leverage</span>
              <div className="text-sm font-extrabold text-zinc-200">
                {activeTrades[0]?.leverage || 20}x
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Total Unrealized P&L</span>
              <div className={`text-sm font-extrabold flex items-center gap-0.5 ${totalFloatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalFloatingPnl >= 0 ? '+' : ''}
                {totalFloatingPnl.toFixed(4)} <span className="text-[10px] font-medium">USDT</span>
              </div>
            </div>
          </div>
        )}

        {activeTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-zinc-800/80 rounded-2xl">
            <p className="text-xs text-zinc-500 font-medium">No active paper positions currently running in this strategy.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase tracking-wider border-b border-zinc-800/50">
                  <th className="pb-3">Open Time (Jeddah)</th>
                  <th className="pb-3">Pair</th>
                  <th className="pb-3 text-center">Direction</th>
                  <th className="pb-3 text-right">Entry Price</th>
                  <th className="pb-3 text-right">Live Price</th>
                  <th className="pb-3 text-center">Duration</th>
                  <th className="pb-3 text-right">Size</th>
                  <th className="pb-3 text-right">Floating Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-xs">
                {activeTrades.map((t) => {
                  const curPrice = livePrices[t.pair] || t.entry_price;
                  const pnl = (curPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                  const isProfit = pnl >= 0;
                  
                  const entryTime = new Date(t.timestamp);
                  const durationMs = Date.now() - entryTime.getTime();
                  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                  const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                  const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

                  return (
                    <tr key={t.id} className="hover:bg-zinc-900/10">
                      <td className="py-3.5 font-mono text-zinc-400">{entryTime.toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}</td>
                      <td className="py-3.5 font-bold text-zinc-200">{t.pair}</td>
                      <td className="py-3.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase ${
                            t.direction === 'LONG'
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                              : 'bg-red-950/20 border-red-900/50 text-red-400'
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono text-zinc-300">{t.entry_price}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-300">{curPrice}</td>
                      <td className="py-3.5 text-center text-zinc-400 font-mono">{durationStr}</td>
                      <td className="py-3.5 text-right text-zinc-400 font-mono">
                        <div className="font-bold text-zinc-300">{t.margin ? `${t.margin.toFixed(1)} USDT` : '1.0 USDT'}</div>
                        <div className="text-[9px] text-zinc-500">{t.leverage || 20}x leverage</div>
                      </td>
                      <td
                        className={`py-3.5 text-right font-mono font-bold flex items-center justify-end gap-1 ${
                          isProfit ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        <span>
                          {isProfit ? '+' : ''}
                          {pnl.toFixed(2)} USDT
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

      {/* Trade Execution Ledger */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
        <h3 className="text-md font-bold text-zinc-200 pb-2 border-b border-zinc-800/50 flex items-center justify-between">
          <span>Completed Trade Ledger (Paper Sandbox)</span>
          <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400">
            {trades.length} trades
          </span>
        </h3>

        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-zinc-800/80 rounded-2xl">
            <p className="text-xs text-zinc-500 font-medium">No closed paper trade records found for this strategy.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase tracking-wider border-b border-zinc-800/50">
                  <th className="pb-3">Close Time (Jeddah)</th>
                  <th className="pb-3">Pair</th>
                  <th className="pb-3 text-center">Direction</th>
                  <th className="pb-3 text-right">Entry Price</th>
                  <th className="pb-3 text-right">Exit Price</th>
                  <th className="pb-3 text-right">Risk (USDT)</th>
                  <th className="pb-3 text-right">Net Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-xs">
                {trades.map((t) => {
                  const isWin = (t.pnl || 0) > 0;
                  const closeTime = new Date(t.closed_at).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });
                  return (
                    <tr key={t.id} className="hover:bg-zinc-900/10">
                      <td className="py-3.5 font-mono text-zinc-400">{closeTime}</td>
                      <td className="py-3.5 font-bold text-zinc-200">{t.pair}</td>
                      <td className="py-3.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase ${
                            t.direction === 'LONG'
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                              : 'bg-red-950/20 border-red-900/50 text-red-400'
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono text-zinc-300">{t.entry_price}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-300">{t.exit_price || 'N/A'}</td>
                      <td className="py-3.5 text-right text-zinc-400 font-mono">
                        <div className="font-bold text-zinc-300">{t.margin ? `${t.margin.toFixed(1)} USDT` : '1.0 USDT'}</div>
                        <div className="text-[9px] text-zinc-500">{t.leverage || 20}x leverage</div>
                      </td>
                      <td
                        className={`py-3.5 text-right font-mono font-bold flex items-center justify-end gap-1 ${
                          isWin ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isWin ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        <span>
                          {isWin ? '+' : ''}
                          {(t.pnl || 0).toFixed(2)} USDT
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
  );
}
