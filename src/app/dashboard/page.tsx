'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Play,
  ShieldAlert,
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
  Activity,
  FlaskConical,
  Eye,
  X,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Stats {
  botEnabled: boolean;
  balance: number;
  realBalance?: number;
  balanceFetched: boolean;
  balanceError: string;
  todayPnl: number;
  winRate: number;
  openTradesCount: number;
  lastScanAt: string | null;
  lastScanLogs: string[];
  tradingMode: 'DEMO' | 'REAL';
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
  leverage?: number;
  margin?: number;
  strategy?: string;
  is_paper?: boolean;
  binance_order_id?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingBot, setIsTogglingBot] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [isClosingAll, setIsClosingAll] = useState(false);
  const [binancePositions, setBinancePositions] = useState<any[]>([]);
  const [paperTrades, setPaperTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<'db' | 'binance' | 'sandbox' | 'chart'>('binance');
  const [isClosingBinanceSymbol, setIsClosingBinanceSymbol] = useState<string | null>(null);
  const [positionsSearchQuery, setPositionsSearchQuery] = useState('');
  const [dashboardMaxTrades, setDashboardMaxTrades] = useState('10');
  const [isSavingMaxTrades, setIsSavingMaxTrades] = useState(false);

  // Live price states via WebSocket
  const [livePrices, setLivePrices] = useState<{ [symbol: string]: number }>({});
  const [priceDirections, setPriceDirections] = useState<{ [symbol: string]: 'up' | 'down' | 'flat' }>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Diagnostics states
  const [isTesting, setIsTesting] = useState(false);
  const [testReport, setTestReport] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isTestingTrade, setIsTestingTrade] = useState(false);
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string | null>(null);

  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [activeStrategies, setActiveStrategies] = useState<string[]>([]);
  const [draftActiveStrategies, setDraftActiveStrategies] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSavingStrategies, setIsSavingStrategies] = useState<boolean>(false);

  const STRATEGIES_LIST = [
    { id: 'PREMIUM_80_WIN', name: 'Premium 80% Win Rate Scalper' },
    { id: 'RSI_MACD', name: 'RSI + MACD Trend' },
    { id: 'BOLLINGER_RSI', name: 'Bollinger + RSI Reversion' },
    { id: 'BOLLINGER_RSI_OPT', name: 'Bollinger + RSI (OPT)' },
    { id: 'DOUBLE_EMA', name: 'Double EMA' },
    { id: 'DOUBLE_EMA_OPT', name: 'Double EMA (OPT)' },
    { id: 'DOUBLE_EMA_5M', name: 'Double EMA 5M' },
    { id: 'DOUBLE_EMA_15M', name: 'Double EMA 15M' },
    { id: 'SUPERTREND_EMA', name: 'SuperTrend + EMA' },
    { id: 'SUPERTREND_EMA_OPT', name: 'SuperTrend + EMA (OPT)' },
    { id: 'STOCH_RSI_MACD', name: 'StochRSI + MACD' },
    { id: 'ATR_BREAKOUT', name: 'ATR Breakout' },
    { id: 'SWING_STRUCTURE', name: 'Swing Structure' },
    { id: 'MACD_DIVERGENCE', name: 'MACD Divergence' },
    { id: 'KDJ_REVERSION', name: 'KDJ Reversion' },
    { id: 'KDJ_REVERSION_OPT', name: 'KDJ Reversion (OPT)' },
    { id: 'FIBONACCI_PULLBACK', name: 'Fib Pullback' },
    { id: 'ICHIMOKU_CLOUDBREAK', name: 'Ichimoku Cloud' },
    { id: 'VWAP_REVERSION', name: 'VWAP Reversion' },
    { id: 'VWAP_REVERSION_OPT', name: 'VWAP Reversion (OPT)' },
    { id: 'RSI_STOCH_EMA_TREND', name: 'RSI + Stoch + EMA Trend' },
    { id: 'CMF_BREAKOUT', name: 'CMF + BB Breakout' },
    { id: 'HULL_MA_CROSSOVER', name: 'Hull MA Crossover' },
    { id: 'DONCHIAN_BREAKOUT', name: 'Donchian Breakout' },
    { id: 'ADX_DI_MOMENTUM', name: 'ADX + DI Momentum' },
    { id: 'REGIME_ENSEMBLE_PRO', name: 'Regime Ensemble Pro' },
    { id: 'COMBINATION_STRATEGIES', name: 'Combo Strategies' },
  ];

  const handleToggleStrategyDraft = (strategyId: string) => {
    let updatedActive = [...draftActiveStrategies];
    if (updatedActive.includes(strategyId)) {
      updatedActive = updatedActive.filter((s) => s !== strategyId);
    } else {
      updatedActive.push(strategyId);
    }
    setDraftActiveStrategies(updatedActive);
  };

  const handleSaveActiveStrategies = async () => {
    if (draftActiveStrategies.length === 0) {
      alert('You must select at least one active strategy!');
      return;
    }
    setIsSavingStrategies(true);
    try {
      const settingsRes = await fetch('/api/settings');
      const currentSettings = await settingsRes.json();

      const pairOverrides = currentSettings.pair_overrides || {};
      const updatedPayload = {
        ...currentSettings,
        pair_overrides: {
          ...pairOverrides,
          ACTIVE_STRATEGIES: draftActiveStrategies,
        },
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload),
      });

      if (res.ok) {
        setActiveStrategies(draftActiveStrategies);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });
      } else {
        alert('Failed to save configuration.');
      }
    } catch (err) {
      console.error('Failed to save strategy config:', err);
      alert('Error saving strategy configuration.');
    } finally {
      setIsSavingStrategies(false);
    }
  };

  const displayedActiveTrades = activeTrades.filter((t) => {
    return !t.is_paper;
  });

  const displayedRecentTrades = recentTrades.filter((t) => {
    const isRealTrade = (t.binance_order_id || '').startsWith('REAL_');
    const isRealMode = stats?.tradingMode === 'REAL';
    return isRealMode ? isRealTrade : !isRealTrade;
  });

  const strategyRealizedPnl = displayedRecentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  const strategyTodayPnl = displayedRecentTrades
    .filter((t) => {
      if (!t.closed_at) return false;
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      return new Date(t.closed_at) >= startOfToday;
    })
    .reduce((sum, t) => sum + (t.pnl || 0), 0);

  const strategyWinRate = (() => {
    const total = displayedRecentTrades.length;
    const wins = displayedRecentTrades.filter((t) => (t.pnl || 0) > 0).length;
    return total > 0 ? (wins / total) * 100 : 0;
  })();

  const runTestTrade = async () => {
    if (isTestingTrade) return;
    const confirmTest = window.confirm(
      `Are you sure you want to execute a market TEST TRADE (0.001 BTC)?\n\n` +
      `This will instantly open a position on your active account (${stats?.tradingMode === 'REAL' ? 'REAL LIVE' : 'DEMO SANDBOX'}) and close it 1 second later to test the complete execution cycle.`
    );
    if (!confirmTest) return;

    try {
      setIsTestingTrade(true);
      const res = await fetch('/api/trades/test-trade', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Success: Test trade executed and closed!\nP&L: ${data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(4)} USDT`);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        fetchDashboardData();
      } else {
        alert(`Test trade execution failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Network error executing test trade: ${err.message}`);
    } finally {
      setIsTestingTrade(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();

      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();

      let activeStrats: string[] = [];
      let defaultStrat = 'ALL';
      if (settingsRes.ok) {
        activeStrats = settingsData.pair_overrides?.ACTIVE_STRATEGIES || [settingsData.active_strategy || 'RSI_MACD'];
        setActiveStrategies(activeStrats);
        setDraftActiveStrategies(activeStrats);
        setDashboardMaxTrades(String(settingsData.max_open_trades !== undefined ? settingsData.max_open_trades : 10));
      }

      const currentStrategyParam = selectedStrategy || defaultStrat;
      if (!selectedStrategy) {
        setSelectedStrategy(defaultStrat);
      }

      const url = currentStrategyParam === 'ALL' ? '/api/trades' : `/api/trades?strategy=${currentStrategyParam}`;
      const tradesRes = await fetch(url);
      const tradesData = await tradesRes.json();

      if (statsData.success) {
        setStats(statsData);
      }
      if (tradesData.success) {
        const allDetailed: Trade[] = tradesData.detailedTrades || [];
        const liveTrades = allDetailed.filter((t) => !t.is_paper);
        const allOpen: Trade[] = tradesData.openTrades || [];
        
        setActiveTrades(allOpen.filter((t) => !t.is_paper));
        setPaperTrades(allOpen.filter((t) => !!t.is_paper));
        setRecentTrades(liveTrades.filter((t) => t.status === 'CLOSED'));

        if (tradesData.binancePositions) {
          setBinancePositions(tradesData.binancePositions);
        } else {
          setBinancePositions([]);
        }

        if (tradesData.livePrices) {
          setLivePrices((prev) => ({ ...prev, ...tradesData.livePrices }));
        }
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
  }, [selectedStrategy]);

  // Binance WebSocket connection for active trades (Live Floating P&L)
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
          setLivePrices((prev) => {
            const oldPrice = prev[symbol] || 0;
            let dir: 'up' | 'down' | 'flat' = 'flat';
            if (closePrice > oldPrice) dir = 'up';
            else if (closePrice < oldPrice) dir = 'down';

            if (dir !== 'flat') {
              setPriceDirections((prevDirs) => ({ ...prevDirs, [symbol]: dir }));
              // Reset flash styling after 1s
              setTimeout(() => {
                setPriceDirections((prevDirs) => ({ ...prevDirs, [symbol]: 'flat' }));
              }, 1000);
            }

            return { ...prev, [symbol]: closePrice };
          });
        }
      } catch (err) {
        console.error('Error parsing live price:', err);
      }
    };

    ws.onclose = () => {
      console.log('Overview WS closed');
    };

    return () => {
      ws.close();
    };
  }, [activeTrades.map(t => t.pair).sort().join(',')]);

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

  const handleEmergencyCloseAll = async () => {
    const confirmClose = window.confirm("⚠️ ARE YOU ABSOLUTELY SURE?\n\nThis will instantly close all open positions on Binance Futures, cancel all pending orders, and mark all active trades in the database as CLOSED!");
    if (!confirmClose) return;

    setIsClosingAll(true);
    try {
      const res = await fetch('/api/trades/close-all', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("🚨 EMERGENCY RESET COMPLETE!\n\nAll live positions closed and database trades resolved successfully.");
        window.location.reload();
      } else {
        alert(`❌ EMERGENCY CLOSE FAILED: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`❌ EMERGENCY CLOSE ERROR: ${err.message}`);
    } finally {
      setIsClosingAll(false);
    }
  };

  const handleCloseAllSandbox = async () => {
    const confirmClose = window.confirm("Are you sure you want to CLOSE all active Sandbox Demo positions in the database?");
    if (!confirmClose) return;

    setIsClosingAll(true);
    try {
      const res = await fetch('/api/trades/close-all?mode=sandbox', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Sandbox Demo positions reset complete!");
        fetchDashboardData();
      } else {
        alert(`Failed to reset: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsClosingAll(false);
    }
  };

  const handleCloseBinancePosition = async (symbol: string) => {
    const confirmClose = window.confirm(`Are you sure you want to CLOSE the active position for ${symbol} on Binance and cancel any associated open orders?`);
    if (!confirmClose) return;

    setIsClosingBinanceSymbol(symbol);
    try {
      const res = await fetch('/api/trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Successfully closed position for ${symbol}!`);
        fetchDashboardData();
      } else {
        alert(`Failed to close position: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error closing position: ${err.message}`);
    } finally {
      setIsClosingBinanceSymbol(null);
    }
  };

  const renderTradingViewChart = () => {
    const symbolToUse = selectedChartSymbol || (binancePositions[0]?.pair || 'BTCUSDT');
    const tradingViewSymbol = `BINANCE:${symbolToUse}`.replace('USDTUSDT', 'USDT');
    
    return (
      <div className="w-full h-[450px] bg-zinc-950/40 border border-zinc-800 rounded-3xl overflow-hidden relative mt-4 shadow-inner">
        <iframe
          title="TradingView Chart"
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${tradingViewSymbol}&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=exchange&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart-embed`}
          className="w-full h-full border-0"
        />
      </div>
    );
  };

  const handleSaveDashboardMaxTrades = async () => {
    setIsSavingMaxTrades(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_open_trades: parseInt(dashboardMaxTrades) })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Successfully set maximum open trades limit to ${dashboardMaxTrades}!`);
        fetchDashboardData();
      } else {
        alert(`Failed to save limit: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error saving limit: ${err.message}`);
    } finally {
      setIsSavingMaxTrades(false);
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

  const runDiagnostics = async () => {
    setIsTesting(true);
    setTestReport(null);
    setShowReportModal(true);

    try {
      const res = await fetch('/api/diagnostics', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestReport(data.report);
        confetti({
          particleCount: 70,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981'],
        });
      } else {
        setTestReport({
          error: data.error || 'Failed to complete diagnostics.',
        });
      }
    } catch (err: any) {
      setTestReport({ error: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsTesting(false);
    }
  };

  const getChartData = () => {
    const completed = displayedRecentTrades.length > 0 ? [...displayedRecentTrades].reverse() : [];
    if (completed.length === 0) {
      return [{ time: 'Start', pnl: 0 }];
    }
    
    let runningSum = 0;
    const data = completed.map((trade) => {
      runningSum += trade.pnl || 0;
      return {
        time: trade.closed_at ? new Date(trade.closed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
        pnl: parseFloat(runningSum.toFixed(2)),
      };
    });

    return [{ time: 'Start', pnl: 0 }, ...data];
  };

  if (isLoading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading VIP Terminal...</p>
      </div>
    );
  }

  const filteredStrategies = STRATEGIES_LIST.filter((strat) =>
    strat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    strat.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasUnsavedChanges = JSON.stringify([...draftActiveStrategies].sort()) !== JSON.stringify([...activeStrategies].sort());

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* 2-column Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Column: Strategies Sidebar Checklist */}
        <div className="lg:col-span-1 bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-4 h-fit space-y-4">
          <div>
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest">Active Engines</h3>
            <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
              Tick to run on Binance, untick to run in Sandbox.
            </p>
          </div>

          {/* Search Box */}
          <div>
            <input
              type="text"
              placeholder="🔍 Search strategy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700/80 transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {/* All Strategies View Toggle */}
            <div
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-200 text-[10px] font-bold cursor-pointer ${
                selectedStrategy === 'ALL'
                  ? 'bg-blue-950/20 text-blue-400 font-extrabold border border-blue-500/25'
                  : 'text-zinc-300 hover:bg-zinc-900/40 hover:text-zinc-200'
              }`}
              onClick={() => setSelectedStrategy('ALL')}
            >
              <span className="uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                All Strategies
              </span>
            </div>
            <div className="h-px bg-zinc-800/50 my-1.5" />

            {filteredStrategies.map((strat) => {
              const isTicked = draftActiveStrategies.includes(strat.id);
              const isSelected = selectedStrategy === strat.id;
              return (
                <div
                  key={strat.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-200 text-[10px] font-bold ${
                    isSelected
                      ? 'bg-emerald-950/20 text-emerald-400 font-extrabold'
                      : 'text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                  }`}
                >
                  <button
                    onClick={() => setSelectedStrategy(strat.id)}
                    className="flex-1 text-left uppercase tracking-wider cursor-pointer outline-none truncate mr-2 font-mono"
                  >
                    {strat.name}
                  </button>
                  <label className="flex items-center justify-center cursor-pointer select-none">
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
            {filteredStrategies.length === 0 && (
              <div className="text-[10px] text-zinc-650 italic text-center py-4">
                No matching engines
              </div>
            )}
          </div>

          {/* Save Button for Draft Config */}
          {hasUnsavedChanges && (
            <div className="pt-2 border-t border-zinc-800/60">
              <button
                onClick={handleSaveActiveStrategies}
                disabled={isSavingStrategies}
                className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition-all duration-300 shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50"
              >
                {isSavingStrategies ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Dashboard Panel details */}
        <div className="lg:col-span-4 space-y-8">

          {/* Welcome & Global Toggle Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  VIP Dashboard <span className="text-zinc-500">/</span> <span className="text-emerald-400 font-bold">{selectedStrategy === 'ALL' ? 'All Strategies' : (STRATEGIES_LIST.find(s => s.id === selectedStrategy)?.name || selectedStrategy)}</span>
                </h2>
                {stats?.tradingMode === 'REAL' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-extrabold uppercase rounded-full bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 animate-pulse tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Live Mode
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-extrabold uppercase rounded-full bg-amber-950/20 text-amber-500 border border-amber-900/50 tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Demo Mode
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Real-time Binance {stats?.tradingMode === 'REAL' ? 'Live Production' : 'Demo Sandbox'} engine tracker.
              </p>
            </div>

        {/* Bot Toggle Switch & Diagnostics */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Symbol to View Chart */}
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedChartSymbol(e.target.value);
                  e.target.value = ''; // Reset select after select
                }
              }}
              defaultValue=""
              className="px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-300 shadow-md cursor-pointer outline-none max-w-[150px]"
            >
              <option value="" disabled>View Charts</option>
              {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'TRXUSDT', 'XRPUSDT', 'LTCUSDT', 'AVAXUSDT', 'XLMUSDT', 'ADAUSDT', 'DOTUSDT', '1000SHIBUSDT', 'ARBUSDT', 'BCHUSDT', 'ATOMUSDT', 'LINKUSDT', 'POLUSDT'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <button
            onClick={runDiagnostics}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 text-emerald-400 ${isTesting ? 'animate-pulse' : ''}`} />
            <span>Test Project</span>
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
              onClick={handleSaveDashboardMaxTrades}
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

          <button
            onClick={handleEmergencyCloseAll}
            disabled={isClosingAll}
            className="flex items-center gap-2 px-5 py-3 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 rounded-2xl text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50"
            title="Instantly close all open positions on Binance and reset database trades"
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>{isClosingAll ? 'Closing All...' : 'Emergency Close'}</span>
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
              {stats?.balance !== undefined ? stats.balance.toFixed(2) : '0.00'}
              <span className="text-sm font-medium text-zinc-500 ml-1.5">USDT</span>
            </h3>
            {stats?.realBalance !== undefined && stats?.balanceFetched && (
              <p className="text-[10px] text-zinc-500 font-semibold mt-1.5 flex items-center gap-1">
                <span>Binance Wallet:</span>
                <span className="text-zinc-300 font-bold">{stats.realBalance.toFixed(2)} USDT</span>
              </p>
            )}
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
                strategyTodayPnl >= 0
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
                strategyTodayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {strategyTodayPnl >= 0 ? '+' : ''}
              {strategyTodayPnl.toFixed(2)}
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
              {strategyWinRate.toFixed(1)}%
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
              {displayedActiveTrades.length}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-2 font-medium">Running on Binance Futures</p>
          </div>
        </div>
      </div>

      {/* Row: Visual Performance Chart & Heartbeat Logs Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <PerformanceChart data={getChartData()} />
        </div>
        <div className="lg:col-span-1">
          <EngineLogsConsole stats={stats} />
        </div>
      </div>

      {/* Grid: Open Positions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Open Positions List */}
        <div className="lg:col-span-2 bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 border-b border-zinc-800/60 pb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-zinc-200">Active Account Tracking</h3>
                <button
                  onClick={fetchDashboardData}
                  className="p-1.5 hover:bg-zinc-800/60 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap bg-zinc-950/80 border border-zinc-800/80 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setActiveTab('binance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'binance'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Binance Wallet ({binancePositions.length})
                </button>
                <button
                  onClick={() => setActiveTab('db')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'db'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  DB Managed ({displayedActiveTrades.length})
                </button>
                <button
                  onClick={() => setActiveTab('sandbox')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'sandbox'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sandbox Demo ({paperTrades.length})
                </button>
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'chart'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Interactive Chart
                </button>
              </div>
            </div>

            {/* Search and Action Bar */}
            {activeTab !== 'chart' && (
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-zinc-850">
                <div className="relative flex-1 max-w-[280px]">
                  <input
                    type="text"
                    placeholder="Search symbol (e.g. BTC)..."
                    value={positionsSearchQuery}
                    onChange={(e) => setPositionsSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-950/65 hover:bg-zinc-950 border border-zinc-800 focus:border-zinc-700 focus:outline-none rounded-xl text-xs text-zinc-300 placeholder-zinc-500 transition-all font-semibold"
                  />
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                
                {activeTab === 'binance' && binancePositions.length > 0 && (
                  <button
                    onClick={handleEmergencyCloseAll}
                    disabled={isClosingAll}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-900/60 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Close All ({binancePositions.length})</span>
                  </button>
                )}

                {activeTab === 'sandbox' && paperTrades.length > 0 && (
                  <button
                    onClick={handleCloseAllSandbox}
                    disabled={isClosingAll}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-900/60 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Close All Sandbox ({paperTrades.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* TAB: BINANCE POSITIONS */}
            {activeTab === 'binance' && (
              <div>
                {binancePositions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-800/80 rounded-2xl">
                    <Layers className="w-8 h-8 text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500 font-medium">No active positions open on Binance Futures</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          <th className="pb-3">Symbol</th>
                          <th className="pb-3 text-center">Direction</th>
                          <th className="pb-3 text-right">Size</th>
                          <th className="pb-3 text-right">Entry Price</th>
                          <th className="pb-3 text-right">Mark Price</th>
                          <th className="pb-3 text-right">Unrealized P&L</th>
                          <th className="pb-3 text-right">Leverage</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 text-sm">
                        {binancePositions
                          .filter((pos) => pos.pair.toUpperCase().includes(positionsSearchQuery.toUpperCase()))
                          .map((pos) => {
                            const pnl = pos.unrealizedPnl;
                            const isProfit = pnl >= 0;
                            return (
                            <tr key={pos.symbol} className="group">
                              <td className="py-4 font-bold text-zinc-200">{pos.pair}</td>
                              <td className="py-4 text-center">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${
                                    pos.side === 'LONG'
                                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                                      : 'bg-red-950/20 border-red-900/50 text-red-400'
                                  }`}
                                >
                                  {pos.side}
                                </span>
                              </td>
                              <td className="py-4 text-right font-mono font-medium">{pos.contracts.toFixed(3)}</td>
                              <td className="py-4 text-right font-mono">{pos.entryPrice.toFixed(4)}</td>
                              <td className="py-4 text-right font-mono">{pos.markPrice.toFixed(4)}</td>
                              <td className="py-4 text-right font-mono font-bold">
                                <span className={isProfit ? 'text-emerald-400' : 'text-red-400'}>
                                  {isProfit ? '+' : ''}{pnl.toFixed(2)} USDT
                                </span>
                              </td>
                              <td className="py-4 text-right font-mono text-zinc-400">{pos.leverage}x</td>
                              <td className="py-4 text-right flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedChartSymbol(pos.pair);
                                    setActiveTab('chart');
                                  }}
                                  className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950/20 rounded-lg transition-colors cursor-pointer"
                                  title="View Live Chart"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleCloseBinancePosition(pos.symbol)}
                                  disabled={isClosingBinanceSymbol === pos.symbol}
                                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Market Close Position on Binance"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: DB MANAGED TRADES */}
            {activeTab === 'db' && (
              <div>
                {displayedActiveTrades.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-zinc-950/20 border border-zinc-800/50 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Total Deployed Margin</span>
                      <div className="text-sm font-extrabold text-zinc-200 mt-1 font-mono">
                        {displayedActiveTrades.reduce((sum, t) => sum + (t.margin || 10.0), 0).toFixed(2)} <span className="text-[10px] text-zinc-400">USDT</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Total Floating P&L</span>
                      <div className={`text-sm font-extrabold mt-1 font-mono ${
                        displayedActiveTrades.reduce((sum, t) => {
                          const currentPrice = livePrices[t.pair] || t.entry_price;
                          const pnl = (currentPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                          return sum + pnl;
                        }, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {displayedActiveTrades.reduce((sum, t) => {
                          const currentPrice = livePrices[t.pair] || t.entry_price;
                          const pnl = (currentPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                          return sum + pnl;
                        }, 0) >= 0 ? '+' : ''}
                        {displayedActiveTrades.reduce((sum, t) => {
                          const currentPrice = livePrices[t.pair] || t.entry_price;
                          const pnl = (currentPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                          return sum + pnl;
                        }, 0).toFixed(2)} <span className="text-[10px] text-zinc-400">USDT</span>
                      </div>
                    </div>
                  </div>
                )}

                {displayedActiveTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-800/80 rounded-2xl">
                    <Layers className="w-8 h-8 text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500 font-medium">No bot trades registered in database</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          <th className="pb-3">Pair</th>
                          <th className="pb-3">Strategy</th>
                          <th className="pb-3 text-center">Direction</th>
                          <th className="pb-3 text-right">Entry Price</th>
                          <th className="pb-3 text-right">Live Price</th>
                          <th className="pb-3 text-right">Live P&L</th>
                          <th className="pb-3 text-right">SL / TP</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 text-sm">
                        {displayedActiveTrades
                          .filter((trade) => trade.pair.toUpperCase().includes(positionsSearchQuery.toUpperCase()))
                          .map((trade) => {
                            const currentPrice = livePrices[trade.pair] || trade.entry_price;
                            const floatingPnl = (currentPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);
                            const isProfit = floatingPnl >= 0;

                          const flashClass =
                            priceDirections[trade.pair] === 'up'
                              ? 'text-emerald-400 bg-emerald-950/15'
                              : priceDirections[trade.pair] === 'down'
                              ? 'text-red-400 bg-red-950/15'
                              : 'text-zinc-200';

                          return (
                            <tr key={trade.id} className="group">
                              <td className="py-4 font-bold text-zinc-200">{trade.pair}</td>
                              <td className="py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                {STRATEGIES_LIST.find(s => s.id === trade.strategy)?.name || trade.strategy || 'RSI_MACD'}
                              </td>
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
                              <td className="py-4 text-right font-mono">{trade.entry_price.toFixed(4)}</td>
                              <td className="py-4 text-right font-mono font-bold">
                                <span className={`px-2 py-0.5 rounded transition-all duration-300 ${flashClass}`}>
                                  {currentPrice.toFixed(4)}
                                </span>
                              </td>
                              <td className="py-4 text-right font-mono font-bold">
                                <span className={isProfit ? 'text-emerald-400' : 'text-red-400'}>
                                  {isProfit ? '+' : ''}{floatingPnl.toFixed(2)} USDT
                                </span>
                              </td>
                              <td className="py-4 text-right text-xs space-y-0.5">
                                <div className="font-mono text-red-400/80 font-medium">SL: {trade.sl_price.toFixed(4)}</div>
                                <div className="font-mono text-emerald-400/80 font-medium">TP: {trade.tp_price.toFixed(4)}</div>
                              </td>
                              <td className="py-4 text-right flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setSelectedChartSymbol(trade.pair);
                                    setActiveTab('chart');
                                  }}
                                  className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950/20 rounded-lg transition-colors cursor-pointer"
                                  title="View Live Chart"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => closePosition(trade.id, isProfit)}
                                  disabled={closingTradeId === trade.id}
                                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                  title="Force Manual Close"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SANDBOX DEMO TRADES */}
            {activeTab === 'sandbox' && (
              <div>
                {paperTrades.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-zinc-950/20 border border-zinc-800/50 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Total Simulated Margin</span>
                      <div className="text-sm font-extrabold text-zinc-200 mt-1 font-mono">
                        {paperTrades.reduce((sum, t) => sum + (t.margin || 10.0), 0).toFixed(2)} <span className="text-[10px] text-zinc-400">USDT</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Total Simulated P&L</span>
                      <div className={`text-sm font-extrabold mt-1 font-mono ${
                        paperTrades.reduce((sum, t) => {
                          const currentPrice = livePrices[t.pair] || t.entry_price;
                          const pnl = (currentPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                          return sum + pnl;
                        }, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {paperTrades.reduce((sum, t) => {
                          const currentPrice = livePrices[t.pair] || t.entry_price;
                          const pnl = (currentPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                          return sum + pnl;
                        }, 0) >= 0 ? '+' : ''}
                        {paperTrades.reduce((sum, t) => {
                          const currentPrice = livePrices[t.pair] || t.entry_price;
                          const pnl = (currentPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                          return sum + pnl;
                        }, 0).toFixed(2)} <span className="text-[10px] text-zinc-400">USDT</span>
                      </div>
                    </div>
                  </div>
                )}

                {paperTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-800/80 rounded-2xl">
                    <Layers className="w-8 h-8 text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500 font-medium">No sandbox demo trades registered in database</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          <th className="pb-3">Pair</th>
                          <th className="pb-3">Strategy</th>
                          <th className="pb-3 text-center">Direction</th>
                          <th className="pb-3 text-right">Entry Price</th>
                          <th className="pb-3 text-right">Live Price</th>
                          <th className="pb-3 text-right">Live P&L</th>
                          <th className="pb-3 text-right">SL / TP</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50 text-sm">
                        {paperTrades
                          .filter((trade) => trade.pair.toUpperCase().includes(positionsSearchQuery.toUpperCase()))
                          .map((trade) => {
                            const currentPrice = livePrices[trade.pair] || trade.entry_price;
                            const floatingPnl = (currentPrice - trade.entry_price) * trade.amount * (trade.direction === 'LONG' ? 1 : -1);
                            const isProfit = floatingPnl >= 0;

                            const flashClass =
                              priceDirections[trade.pair] === 'up'
                                ? 'text-emerald-400 bg-emerald-950/15'
                                : priceDirections[trade.pair] === 'down'
                                ? 'text-red-400 bg-red-950/15'
                                : 'text-zinc-200';

                            return (
                              <tr key={trade.id} className="group">
                                <td className="py-4 font-bold text-zinc-200">{trade.pair}</td>
                                <td className="py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                  {STRATEGIES_LIST.find(s => s.id === trade.strategy)?.name || trade.strategy || 'RSI_MACD'}
                                </td>
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
                                <td className="py-4 text-right font-mono">{trade.entry_price.toFixed(4)}</td>
                                <td className="py-4 text-right font-mono font-bold">
                                  <span className={`px-2 py-0.5 rounded transition-all duration-300 ${flashClass}`}>
                                    {currentPrice.toFixed(4)}
                                  </span>
                                </td>
                                <td className="py-4 text-right font-mono font-bold">
                                  <span className={isProfit ? 'text-emerald-400' : 'text-red-400'}>
                                    {isProfit ? '+' : ''}{floatingPnl.toFixed(2)} USDT
                                  </span>
                                </td>
                                <td className="py-4 text-right text-xs space-y-0.5">
                                  <div className="font-mono text-red-400/80 font-medium">SL: {trade.sl_price.toFixed(4)}</div>
                                  <div className="font-mono text-emerald-400/80 font-medium">TP: {trade.tp_price.toFixed(4)}</div>
                                </td>
                                <td className="py-4 text-right flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setSelectedChartSymbol(trade.pair);
                                      setActiveTab('chart');
                                    }}
                                    className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950/20 rounded-lg transition-colors cursor-pointer"
                                    title="View Live Chart"
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => closePosition(trade.id, isProfit)}
                                    disabled={closingTradeId === trade.id}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                    title="Force Manual Close"
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: INTERACTIVE CHART */}
            {activeTab === 'chart' && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Active Chart:</span>
                  <select
                    value={selectedChartSymbol || (binancePositions[0]?.pair || 'BTCUSDT')}
                    onChange={(e) => setSelectedChartSymbol(e.target.value)}
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-300 outline-none cursor-pointer"
                  >
                    {binancePositions.length > 0 ? (
                      binancePositions.map((pos) => (
                        <option key={pos.symbol} value={pos.pair}>{pos.pair}</option>
                      ))
                    ) : (
                      ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'TRXUSDT', 'XRPUSDT', 'LTCUSDT', 'XLMUSDT', 'ADAUSDT', 'LINKUSDT'].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))
                    )}
                  </select>
                </div>
                {renderTradingViewChart()}
              </div>
            )}
          </div>
        </div>

        {/* Recent Trade Logs */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-zinc-200 mb-6">Recent Completed Trades</h3>

          {displayedRecentTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800/80 rounded-2xl">
              <HistoryIcon className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-500 font-medium">No trade history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedRecentTrades.slice(0, 5).map((trade) => {
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
                        {trade.closed_at ? new Date(trade.closed_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh' }) : ''}
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

      {/* Close Right Column and 2-column Main Layout Grid */}
        </div>
      </div>

      {/* System Diagnostics Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0c0c0f]/95 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-zinc-200 mb-4 border-b border-zinc-800/50 pb-2">
                System Diagnostics Report
              </h3>

              {isTesting ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-xs text-zinc-400 font-medium animate-pulse">Running live checks...</p>
                </div>
              ) : testReport?.error ? (
                <div className="p-4 bg-red-950/25 border border-red-900/50 rounded-2xl text-red-400 text-xs font-semibold">
                  {testReport.error}
                </div>
              ) : testReport ? (
                <div className="space-y-3.5 text-xs">
                  {/* Database */}
                  <div className="flex justify-between items-start p-3 bg-zinc-900/25 border border-zinc-800/50 rounded-2xl">
                    <span className="font-semibold text-zinc-400">Database Connection</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      testReport.database.status === 'OK' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/20 text-red-400 border border-red-900/50'
                    }`}>
                      {testReport.database.status}
                    </span>
                  </div>

                  {/* Binance API */}
                  <div className="flex flex-col gap-1 p-3 bg-zinc-900/25 border border-zinc-800/50 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-zinc-400">Binance API Key Check</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        testReport.binance.status === 'OK' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/20 text-red-400 border border-red-900/50'
                      }`}>
                        {testReport.binance.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">{testReport.binance.message}</p>
                  </div>

                  {/* Indicators */}
                  <div className="flex flex-col gap-1 p-3 bg-zinc-900/25 border border-zinc-800/50 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-zinc-400">Mathematical Indicators</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        testReport.indicators.status === 'OK' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/20 text-red-400 border border-red-900/50'
                      }`}>
                        {testReport.indicators.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">{testReport.indicators.message}</p>
                  </div>

                  {/* Telegram */}
                  <div className="flex flex-col gap-1 p-3 bg-zinc-900/25 border border-zinc-800/50 rounded-2xl">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-zinc-400">Telegram Alert Route</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        testReport.telegram.status === 'OK' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/20 text-red-400 border border-red-900/50'
                      }`}>
                        {testReport.telegram.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal">{testReport.telegram.message}</p>
                  </div>

                  <p className="text-[10px] text-center text-emerald-400 font-semibold bg-emerald-950/10 border border-emerald-900/30 p-2.5 rounded-xl">
                    Report details have been sent to your Telegram Bot!
                  </p>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => setShowReportModal(false)}
              className="mt-6 w-full py-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 font-semibold rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close Diagnostics
            </button>
          </div>
        </div>
      )}

      {/* TradingView Advanced Real-Time Chart Modal */}
      {selectedChartSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="relative w-full max-w-5xl bg-[#0c0c0f] border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-lg font-bold text-zinc-200 uppercase tracking-wide">
                  Live Market Chart: {selectedChartSymbol}
                </h3>
              </div>
              <button
                onClick={() => setSelectedChartSymbol(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50 border border-zinc-800/60 rounded-lg transition-colors cursor-pointer"
                title="Close Chart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TradingView Widget Frame */}
            <div className="w-full h-[500px] bg-black/30 rounded-2xl overflow-hidden border border-zinc-800/60">
              <iframe
                src={`https://s.tradingview.com/widgetembed/?symbol=BINANCE:${selectedChartSymbol.toUpperCase()}&theme=dark&interval=1&hidesidetoolbar=0&symboledit=0&saveimage=1&toolbarbg=1c1d22&style=1&timezone=Etc%2FUTC&locale=en`}
                className="w-full h-full border-0"
                allowFullScreen
              />
            </div>
            
            {/* Modal Footer */}
            <div className="mt-4 text-right">
              <button
                onClick={() => setSelectedChartSymbol(null)}
                className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all duration-200 cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Custom SVG Cumulative P&L Area/Line Chart
// ---------------------------------------------------------
function PerformanceChart({ data }: { data: { time: string; pnl: number }[] }) {
  const width = 500;
  const height = 150;
  const padding = 20;

  const pnls = data.map((d) => d.pnl);
  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 5); // default min max range

  const pnlRange = maxPnl - minPnl;
  const xStep = (width - padding * 2) / (data.length - 1 || 1);

  // Generate coordinates (x, y)
  const points = data.map((d, i) => {
    const x = padding + i * xStep;
    // Normalize Y to range [padding, height - padding]
    const y = height - padding - ((d.pnl - minPnl) / (pnlRange || 1)) * (height - padding * 2);
    return { x, y, ...d };
  });

  // Create path strings
  const linePath = points.reduce(
    (path, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`),
    ''
  );

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : '';

  return (
    <div className="w-full bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300 h-full flex flex-col justify-between">
      <div>
        <h3 className="text-md font-bold text-zinc-200">P&L Performance</h3>
        <p className="text-xs text-zinc-500 font-medium">Cumulative account profit growth</p>
      </div>
      <div className="relative w-full h-[160px] mt-4 flex items-center justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1e1e24" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1e1e24" strokeWidth="1" strokeDasharray="3,3" />

          {/* Area under the line */}
          {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

          {/* Glowing Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="drop-shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
            />
          )}

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i} className="group/dot">
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="#09090b"
                stroke="#10b981"
                strokeWidth="2.5"
                className="transition-all duration-200 hover:r-6 cursor-pointer"
              />
              <title>{`${p.time}: ${p.pnl.toFixed(2)} USDT`}</title>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Heartbeat Monitor & Console Logs Terminal Panel
// ---------------------------------------------------------
function EngineLogsConsole({ stats }: { stats: Stats | null }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(t);
  }, []);

  if (!stats) return null;

  // Determine health
  const lastScan = stats.lastScanAt ? new Date(stats.lastScanAt) : null;
  
  // Consider online if last scan was within 90 seconds and bot is enabled
  const isOnline = stats.botEnabled && lastScan && (now.getTime() - lastScan.getTime()) < 90000;
  
  let statusBadge = '🔴 SYSTEM OFFLINE';
  let badgeColor = 'bg-red-950/20 border-red-900/50 text-red-400';
  if (stats.botEnabled) {
    if (isOnline) {
      statusBadge = '🟢 ENGINE ACTIVE';
      badgeColor = 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400 shadow-md shadow-emerald-500/5';
    } else {
      statusBadge = '⚠️ CRON LAG';
      badgeColor = 'bg-amber-950/20 border-amber-900/50 text-amber-400 shadow-md shadow-amber-500/5';
    }
  } else {
    statusBadge = '⚪ ENGINE PAUSED';
    badgeColor = 'bg-zinc-900/60 border-zinc-800 text-zinc-500';
  }

  // Format relative time for last scan
  const getRelativeTimeString = () => {
    if (!lastScan) return 'Never';
    const secAgo = Math.floor((now.getTime() - lastScan.getTime()) / 1000);
    if (secAgo < 5) return 'Just now';
    if (secAgo < 60) return `${secAgo}s ago`;
    return `${Math.floor(secAgo / 60)}m ago`;
  };

  return (
    <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 flex flex-col h-[280px] justify-between group hover:border-zinc-700/80 transition-all duration-300">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-md font-bold text-zinc-200">Terminal Scans Log</h3>
          <div className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border ${badgeColor}`}>
            {statusBadge}
          </div>
        </div>

        <div className="bg-black/40 border border-zinc-800/60 rounded-xl p-3 h-[160px] overflow-y-auto font-mono text-[11px] text-zinc-400 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
          {stats.lastScanLogs && stats.lastScanLogs.length > 0 ? (
            stats.lastScanLogs.map((log, i) => {
              let color = 'text-zinc-500';
              if (log.includes('Triggered')) color = 'text-emerald-400 font-bold';
              else if (log.includes('Failed') || log.includes('Error')) color = 'text-red-400';
              else if (log.includes('Executing')) color = 'text-blue-400 font-semibold';
              
              return (
                <div key={i} className={color}>
                  {log}
                </div>
              );
            })
          ) : (
            <div className="text-zinc-600 italic">No logs recorded yet. Toggling bot ON will start engine logging...</div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-medium border-t border-zinc-800/50 pt-3">
        <span>Pulse frequency: 60s</span>
        <span>Last scan: {getRelativeTimeString()}</span>
      </div>
    </div>
  );
}
