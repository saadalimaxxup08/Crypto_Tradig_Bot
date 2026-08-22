'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, Calendar, Download, Send, ArrowUpRight, ArrowDownRight, Layers, HelpCircle, DollarSign, TrendingUp, Percent, Trophy } from 'lucide-react';
import { jsPDF } from 'jspdf';

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
  const [isSending, setIsSending] = useState(false);
  const [includePairwise, setIncludePairwise] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [hourlyFilter, setHourlyFilter] = useState<'none' | '1h' | '3h' | '6h' | '12h'>('none');
  const [selectedStrategy, setSelectedStrategy] = useState<'RSI_MACD' | 'BOLLINGER_RSI' | 'BOLLINGER_RSI_OPT' | 'DOUBLE_EMA' | 'DOUBLE_EMA_OPT' | 'DOUBLE_EMA_5M' | 'DOUBLE_EMA_15M' | 'SUPERTREND_EMA' | 'SUPERTREND_EMA_OPT' | 'STOCH_RSI_MACD' | 'ATR_BREAKOUT' | 'SWING_STRUCTURE' | 'MACD_DIVERGENCE' | 'KDJ_REVERSION' | 'KDJ_REVERSION_OPT' | 'FIBONACCI_PULLBACK' | 'ICHIMOKU_CLOUDBREAK' | 'VWAP_REVERSION' | 'VWAP_REVERSION_OPT' | 'COMBINATION_STRATEGIES' | 'RSI_STOCH_EMA_TREND' | 'CMF_BREAKOUT' | 'HULL_MA_CROSSOVER' | 'DONCHIAN_BREAKOUT' | 'ADX_DI_MOMENTUM' | 'REGIME_ENSEMBLE_PRO'>('BOLLINGER_RSI');
  const [activeStrategySetting, setActiveStrategySetting] = useState('RSI_MACD');
  const [allRawTrades, setAllRawTrades] = useState<Trade[]>([]);
  const [dbSettings, setDbSettings] = useState<any>(null);
  const [localPairsConfig, setLocalPairsConfig] = useState<Record<string, boolean>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
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
      if (settingsRes.ok) {
        setDbSettings(settingsData);
        if (settingsData.active_strategy) {
          currentActiveStrategy = settingsData.active_strategy;
          setActiveStrategySetting(currentActiveStrategy);
        }
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

  const pairStats = useMemo(() => {
    const stats: Record<string, { wins: number; losses: number }> = {};
    const activePairs = dbSettings?.pairs || [];
    activePairs.forEach((p: string) => {
      stats[p] = { wins: 0, losses: 0 };
    });

    trades.forEach((t) => {
      if (!stats[t.pair]) {
        stats[t.pair] = { wins: 0, losses: 0 };
      }
      const pnl = parseFloat(t.pnl as any || 0);
      if (pnl > 0) {
        stats[t.pair].wins += 1;
      } else {
        stats[t.pair].losses += 1;
      }
    });
    return stats;
  }, [trades, dbSettings]);

  const strategyAllClosedTrades = useMemo(() => {
    const isTabPaper = selectedStrategy !== activeStrategySetting;
    return allRawTrades.filter((t) => 
      (t.strategy || 'RSI_MACD') === selectedStrategy && 
      (isTabPaper ? t.is_paper === true : !t.is_paper) &&
      t.status === 'CLOSED'
    );
  }, [allRawTrades, selectedStrategy, activeStrategySetting]);

  const todayPnl = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

    return strategyAllClosedTrades
      .filter((t) => {
        if (!t.closed_at) return false;
        const tDate = new Date(t.closed_at);
        const tParts = formatter.formatToParts(tDate);
        const tYear = tParts.find(p => p.type === 'year')?.value;
        const tMonth = tParts.find(p => p.type === 'month')?.value;
        const tDay = tParts.find(p => p.type === 'day')?.value;
        return `${tYear}-${tMonth}-${tDay}` === `${year}-${month + 1}-${day}`;
      })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [strategyAllClosedTrades]);

  const yesterdayPnl = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(yesterday);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

    return strategyAllClosedTrades
      .filter((t) => {
        if (!t.closed_at) return false;
        const tDate = new Date(t.closed_at);
        const tParts = formatter.formatToParts(tDate);
        const tYear = tParts.find(p => p.type === 'year')?.value;
        const tMonth = tParts.find(p => p.type === 'month')?.value;
        const tDay = tParts.find(p => p.type === 'day')?.value;
        return `${tYear}-${tMonth}-${tDay}` === `${year}-${month + 1}-${day}`;
      })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [strategyAllClosedTrades]);

  useEffect(() => {
    if (!dbSettings) return;
    const config: Record<string, boolean> = {};
    const activePairs = dbSettings.pairs || [];
    activePairs.forEach((p: string) => {
      const disabledStrats = dbSettings.pair_overrides?.[p]?.disabled_strategies || [];
      config[p] = !disabledStrats.includes(selectedStrategy);
    });
    setLocalPairsConfig(config);
  }, [dbSettings, selectedStrategy]);

  const handleSavePairsConfig = async () => {
    if (!dbSettings) return;
    setIsSavingConfig(true);
    setStatusMsg({ type: '', text: '' });

    const newOverrides = { ...(dbSettings.pair_overrides || {}) };
    const activePairs = dbSettings.pairs || [];

    activePairs.forEach((p: string) => {
      if (!newOverrides[p]) {
        newOverrides[p] = {};
      }
      const disabledStrats = [...(newOverrides[p].disabled_strategies || [])];
      const isEnabled = localPairsConfig[p];

      if (isEnabled) {
        const idx = disabledStrats.indexOf(selectedStrategy);
        if (idx > -1) {
          disabledStrats.splice(idx, 1);
        }
      } else {
        if (!disabledStrats.includes(selectedStrategy)) {
          disabledStrats.push(selectedStrategy);
        }
      }

      newOverrides[p].disabled_strategies = disabledStrats;
    });

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair_overrides: newOverrides })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbSettings((prev: any) => ({
          ...prev,
          pair_overrides: newOverrides
        }));
        setStatusMsg({ type: 'success', text: 'Strategy pairs configuration updated successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to update configuration.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSavingConfig(false);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
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
  const setRangeQuick = (rangeType: 'today' | 'yesterday' | '2days' | '3days' | '5days' | 'week' | 'month') => {
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
    } else if (rangeType === '2days') {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(today.getDate() - 2);
      setStartDate(formatDateStr(twoDaysAgo));
      setEndDate(formatDateStr(today));
    } else if (rangeType === '3days') {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(today.getDate() - 3);
      setStartDate(formatDateStr(threeDaysAgo));
      setEndDate(formatDateStr(today));
    } else if (rangeType === '5days') {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(today.getDate() - 5);
      setStartDate(formatDateStr(fiveDaysAgo));
      setEndDate(formatDateStr(today));
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

  const leaderboard = useMemo(() => {
    return ['RSI_MACD', 'COMBINATION_STRATEGIES', 'REGIME_ENSEMBLE_PRO', 'BOLLINGER_RSI', 'BOLLINGER_RSI_OPT', 'DOUBLE_EMA', 'DOUBLE_EMA_OPT', 'DOUBLE_EMA_5M', 'DOUBLE_EMA_15M', 'SUPERTREND_EMA', 'SUPERTREND_EMA_OPT', 'STOCH_RSI_MACD', 'ATR_BREAKOUT', 'SWING_STRUCTURE', 'MACD_DIVERGENCE', 'KDJ_REVERSION', 'KDJ_REVERSION_OPT', 'FIBONACCI_PULLBACK', 'ICHIMOKU_CLOUDBREAK', 'VWAP_REVERSION', 'VWAP_REVERSION_OPT', 'RSI_STOCH_EMA_TREND', 'CMF_BREAKOUT', 'HULL_MA_CROSSOVER', 'DONCHIAN_BREAKOUT', 'ADX_DI_MOMENTUM'].map(strat => {
      const isPaper = strat !== activeStrategySetting;
      const stratTrades = allRawTrades.filter(t => 
        (t.strategy || 'RSI_MACD') === strat && 
        (isPaper ? t.is_paper : !t.is_paper)
      );
      
      const closed = stratTrades.filter((t) => {
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

      const active = stratTrades.filter(t => t.status === 'OPEN');
      const realizedPnl = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const floatingPnl = active.reduce((sum, t) => {
        const curPrice = livePrices[t.pair] || t.entry_price;
        return sum + ((curPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1));
      }, 0);

      const netPnl = realizedPnl + floatingPnl;
      const total = closed.length;
      const wins = closed.filter(t => (t.pnl || 0) > 0).length;
      const losses = total - wins;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      const balance = 100.0 + realizedPnl;

      return {
        strategy: strat,
        balance,
        netPnl,
        realizedPnl,
        winRate,
        totalTrades: total,
        wins,
        losses
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [allRawTrades, livePrices, startDate, endDate, hourlyFilter, activeStrategySetting]);

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

  // PDF Generator Engine (using jsPDF)
  const generatePDF = (download: boolean = true) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const finalStrategyName = selectedStrategy === 'BOLLINGER_RSI'
      ? 'Bollinger Bands + RSI Reversion'
      : selectedStrategy === 'BOLLINGER_RSI_OPT'
      ? 'Bollinger Bands + RSI Reversion (Optimized)'
      : selectedStrategy === 'DOUBLE_EMA'
      ? 'Double EMA Crossover'
      : selectedStrategy === 'DOUBLE_EMA_OPT'
      ? 'Double EMA Crossover (Optimized)'
      : selectedStrategy === 'DOUBLE_EMA_5M'
      ? 'Double EMA 5-Minute'
      : selectedStrategy === 'DOUBLE_EMA_15M'
      ? 'Double EMA 15-Minute'
      : selectedStrategy === 'SUPERTREND_EMA'
      ? 'SuperTrend + 200 EMA'
      : selectedStrategy === 'SUPERTREND_EMA_OPT'
      ? 'SuperTrend + 200 EMA (Optimized)'
      : selectedStrategy === 'STOCH_RSI_MACD'
      ? 'Stochastic RSI + MACD Crossover'
      : selectedStrategy === 'ATR_BREAKOUT'
      ? 'ATR Channel Breakout'
      : selectedStrategy === 'SWING_STRUCTURE'
      ? 'Swing S&R Structure'
      : selectedStrategy === 'MACD_DIVERGENCE'
      ? 'MACD Reversal Divergence'
      : selectedStrategy === 'KDJ_REVERSION'
      ? 'KDJ + StochRSI Reversion'
      : selectedStrategy === 'KDJ_REVERSION_OPT'
      ? 'KDJ + StochRSI Reversion (Optimized)'
      : selectedStrategy === 'FIBONACCI_PULLBACK'
      ? 'EMA Fibonacci Pullback'
      : selectedStrategy === 'ICHIMOKU_CLOUDBREAK'
      ? 'Ichimoku Cloud Breakout'
      : selectedStrategy === 'VWAP_REVERSION'
      ? 'VWAP Volatility Band Reversion'
      : selectedStrategy === 'VWAP_REVERSION_OPT'
      ? 'VWAP Volatility Band Reversion (Optimized)'
      : selectedStrategy === 'COMBINATION_STRATEGIES'
      ? 'Combination Portfolio Dispatcher'
      : selectedStrategy === 'REGIME_ENSEMBLE_PRO'
      ? 'Regime-Aware Ensemble Pro'
      : selectedStrategy === 'RSI_STOCH_EMA_TREND'
      ? 'RSI + Stochastic + EMA Trend'
      : selectedStrategy === 'CMF_BREAKOUT'
      ? 'Chaikin Money Flow Breakout'
      : selectedStrategy === 'HULL_MA_CROSSOVER'
      ? 'Hull Moving Average Crossover'
      : selectedStrategy === 'DONCHIAN_BREAKOUT'
      ? 'Donchian Channel Breakout'
      : selectedStrategy === 'ADX_DI_MOMENTUM'
      ? 'ADX DI Momentum Crossover'
      : 'RSI + MACD Momentum Crossover';

    // 1. Header Dark Banner Branding
    doc.setFillColor(15, 15, 20); // Dark carbon color
    doc.rect(0, 0, 210, 32, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`CryptoAI Sandbox: ${finalStrategyName}`, 14, 13);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 165);
    doc.text("Simulated Strategy Backtest Report (Jeddah Time)", 14, 19);
    
    const dateRangeStr = `Period: ${new Date(startDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })} to ${new Date(endDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })}`;
    doc.text(dateRangeStr, 196, 19, { align: 'right' });

    // 2. Metrics Bounding Box Cards Grid
    const cardY = 40;
    const cardH = 18;
    
    doc.setDrawColor(225, 225, 230);
    doc.setFillColor(255, 255, 255);

    // Card 1: Total Trades
    doc.rect(14, cardY, 41, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("TOTAL CLOSED TRADES", 17, cardY + 5);
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 35);
    doc.text(`${totalTrades}`, 17, cardY + 12);

    // Card 2: Win Rate
    doc.rect(59, cardY, 41, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("WIN RATE SPEED", 62, cardY + 5);
    doc.setFontSize(11);
    doc.setTextColor(147, 51, 234);
    doc.text(`${winRate.toFixed(1)}%`, 62, cardY + 12);
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text(`Wins: ${wins} / Losses: ${losses}`, 62, cardY + 16);

    // Card 3: Total P&L / Sandbox Wallet Balance
    doc.rect(104, cardY, 44, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("TOTAL NET P&L", 107, cardY + 5);
    doc.setFontSize(11);
    if (totalPnl >= 0) {
      doc.setTextColor(16, 185, 129);
      doc.text(`+${totalPnl.toFixed(4)}`, 107, cardY + 12);
    } else {
      doc.setTextColor(239, 68, 68);
      doc.text(`${totalPnl.toFixed(4)}`, 107, cardY + 12);
    }
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text(`Wallet: ${currentBalance.toFixed(2)} USDT`, 107, cardY + 16);

    // Card 4: Avg Return
    doc.rect(152, cardY, 44, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("AVERAGE RETURN", 155, cardY + 5);
    doc.setFontSize(11);
    const avgReturn = totalTrades > 0 ? totalPnl / totalTrades : 0;
    if (avgReturn >= 0) {
      doc.setTextColor(16, 185, 129);
      doc.text(`+${avgReturn.toFixed(4)}`, 155, cardY + 12);
    } else {
      doc.setTextColor(239, 68, 68);
      doc.text(`${avgReturn.toFixed(4)}`, 155, cardY + 12);
    }
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("USDT per operation", 155, cardY + 16);

    let currentY = 70;

    // 3. Active Positions Table
    if (activeTrades.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 35);
      doc.text(`ACTIVE RUNNING POSITIONS (${activeTrades.length})`, 14, currentY);
      currentY += 4;

      doc.setFillColor(245, 245, 248);
      doc.rect(14, currentY - 4, 182, 6, 'F');
      
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 85);
      doc.text("Open Time (Jeddah)", 17, currentY);
      doc.text("Pair", 54, currentY);
      doc.text("Direction", 80, currentY);
      doc.text("Entry Price", 98, currentY);
      doc.text("Live Price", 125, currentY);
      doc.text("Duration", 152, currentY);
      doc.text("Floating P&L", 175, currentY);
      
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      activeTrades.forEach((t) => {
        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }
        const curPrice = livePrices[t.pair] || t.entry_price;
        const pnl = (curPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
        const entryTime = new Date(t.timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) + ' ' + new Date(t.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false });
        
        const timeInMarket = new Date(t.timestamp);
        const durationMs = Date.now() - timeInMarket.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

        doc.setTextColor(30, 30, 35);
        doc.text(entryTime, 17, currentY);
        doc.text(t.pair, 54, currentY);
        
        if (t.direction === 'LONG') {
          doc.setTextColor(16, 185, 129);
          doc.setFont('helvetica', 'bold');
          doc.text("LONG", 80, currentY);
        } else {
          doc.setTextColor(239, 68, 68);
          doc.setFont('helvetica', 'bold');
          doc.text("SHORT", 80, currentY);
        }
        doc.setFont('helvetica', 'normal');
        
        doc.setTextColor(80, 80, 85);
        doc.text(t.entry_price.toFixed(4), 98, currentY);
        doc.text(curPrice.toFixed(4), 125, currentY);
        doc.text(durationStr, 152, currentY);

        if (pnl >= 0) {
          doc.setTextColor(16, 185, 129);
          doc.setFont('helvetica', 'bold');
          doc.text(`+${pnl.toFixed(2)} USDT`, 175, currentY);
        } else {
          doc.setTextColor(239, 68, 68);
          doc.setFont('helvetica', 'bold');
          doc.text(`${pnl.toFixed(2)} USDT`, 175, currentY);
        }
        doc.setFont('helvetica', 'normal');

        doc.setDrawColor(240, 240, 245);
        doc.line(14, currentY + 1.5, 196, currentY + 1.5);
        currentY += 5.5;
      });

      currentY += 5;
    }

    // 4. Closed Trades Ledger Table
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 35);
    doc.text(`CLOSED TRADES LEDGER (${trades.length})`, 14, currentY);
    currentY += 4;

    doc.setFillColor(245, 245, 248);
    doc.rect(14, currentY - 4, 182, 6, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 85);
    doc.text("Close Time (Jeddah)", 17, currentY);
    doc.text("Pair", 54, currentY);
    doc.text("Direction", 80, currentY);
    doc.text("Entry Price", 98, currentY);
    doc.text("Exit Price", 125, currentY);
    doc.text("Margin", 152, currentY);
    doc.text("Leverage", 168, currentY);
    doc.text("Realized P&L", 180, currentY);
    
    currentY += 4;

    doc.setFont('helvetica', 'normal');
    trades.forEach((t) => {
      if (currentY > 275) {
        doc.addPage();
        currentY = 20;
      }
      const closeTime = new Date(t.closed_at).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) + ' ' + new Date(t.closed_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false });
      const pnlVal = t.pnl || 0;
      const isWin = pnlVal >= 0;

      doc.setTextColor(30, 30, 35);
      doc.text(closeTime, 17, currentY);
      doc.text(t.pair, 54, currentY);

      if (t.direction === 'LONG') {
        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.text("LONG", 80, currentY);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.text("SHORT", 80, currentY);
      }
      doc.setFont('helvetica', 'normal');

      doc.setTextColor(80, 80, 85);
      doc.text(t.entry_price.toFixed(4), 98, currentY);
      doc.text(t.exit_price ? t.exit_price.toFixed(4) : 'N/A', 125, currentY);
      doc.text(`${(t.margin || 1.0).toFixed(1)} USDT`, 152, currentY);
      doc.text(`${t.leverage || 20}x`, 168, currentY);

      if (isWin) {
        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.text(`+${pnlVal.toFixed(2)} USDT`, 180, currentY);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.text(`${pnlVal.toFixed(2)} USDT`, 180, currentY);
      }
      doc.setFont('helvetica', 'normal');

      doc.setDrawColor(240, 240, 245);
      doc.line(14, currentY + 1.5, 196, currentY + 1.5);
      currentY += 5.5;
    });

    // 5. Dynamic Pair-wise Performance Summary
    if (includePairwise) {
      const pairStats: Record<string, { total: number; wins: number; pnl: number }> = {};
      trades.forEach((t) => {
        if (!pairStats[t.pair]) {
          pairStats[t.pair] = { total: 0, wins: 0, pnl: 0 };
        }
        pairStats[t.pair].total += 1;
        if ((t.pnl || 0) > 0) {
          pairStats[t.pair].wins += 1;
        }
        pairStats[t.pair].pnl += (t.pnl || 0);
      });

      const sortedPairs = Object.entries(pairStats).sort((a, b) => {
        const wrA = a[1].total > 0 ? (a[1].wins / a[1].total) * 100 : 0;
        const wrB = b[1].total > 0 ? (b[1].wins / b[1].total) * 100 : 0;
        if (wrB !== wrA) {
          return wrB - wrA;
        }
        return b[1].pnl - a[1].pnl;
      });

      let allConfiguredPairs = Object.keys(livePrices);
      if (allConfiguredPairs.length === 0) {
        allConfiguredPairs = [
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
          'DOGEUSDT', 'ADAUSDT', 'TONUSDT', '1000SHIBUSDT', 'TRXUSDT',
          'AVAXUSDT', 'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'LINKUSDT',
          'ATOMUSDT', 'XLMUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT'
        ];
      }

      const nonTradedPairs = allConfiguredPairs.filter((p) => !pairStats[p]);

      if (sortedPairs.length > 0 || nonTradedPairs.length > 0) {
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 35);
        doc.text("PAIR-WISE PERFORMANCE SUMMARY", 14, currentY);
        currentY += 4;

        // Table Header fill
        doc.setFillColor(245, 245, 248);
        doc.rect(14, currentY - 4, 182, 6, 'F');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 85);
        doc.text("Asset Pair", 17, currentY);
        doc.text("Total Trades", 64, currentY);
        doc.text("Wins / Losses", 100, currentY);
        doc.text("Win Rate %", 140, currentY);
        doc.text("Net Realized P&L", 175, currentY);
        currentY += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);

        // 1. Render Traded Pairs
        sortedPairs.forEach(([pair, stats]) => {
          if (currentY > 275) {
            doc.addPage();
            currentY = 20;
          }

          const wr = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
          const ls = stats.total - stats.wins;

          doc.setTextColor(30, 30, 35);
          doc.text(pair, 17, currentY);
          doc.text(stats.total.toString(), 64, currentY);
          doc.text(`${stats.wins}W - ${ls}L`, 100, currentY);
          doc.text(`${wr.toFixed(1)}%`, 140, currentY);

          if (stats.pnl >= 0) {
            doc.setTextColor(16, 185, 129);
            doc.setFont('helvetica', 'bold');
            doc.text(`+${stats.pnl.toFixed(4)} USDT`, 175, currentY);
          } else {
            doc.setTextColor(239, 68, 68);
            doc.setFont('helvetica', 'bold');
            doc.text(`${stats.pnl.toFixed(4)} USDT`, 175, currentY);
          }
          doc.setFont('helvetica', 'normal');

          doc.setDrawColor(240, 240, 245);
          doc.line(14, currentY + 1.5, 196, currentY + 1.5);
          currentY += 5.5;
        });

        // 2. Render Non-Traded Pairs (Blank / Zero Stats in Muted Gray)
        nonTradedPairs.forEach((pair) => {
          if (currentY > 275) {
            doc.addPage();
            currentY = 20;
          }

          doc.setTextColor(140, 140, 145); // Muted gray
          doc.text(pair, 17, currentY);
          doc.text("0", 64, currentY);
          doc.text("0W - 0L", 100, currentY);
          doc.text("0.0%", 140, currentY);
          doc.text("0.0000 USDT", 175, currentY);

          doc.setDrawColor(240, 240, 245);
          doc.line(14, currentY + 1.5, 196, currentY + 1.5);
          currentY += 5.5;
        });

        // Total Row at the bottom of pairwise table
        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFillColor(250, 250, 252);
        doc.rect(14, currentY - 4, 182, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 35);
        doc.text("TOTAL REALIZED P&L", 17, currentY);
        
        if (realizedNetPnl >= 0) {
          doc.setTextColor(16, 185, 129);
          doc.text(`+${realizedNetPnl.toFixed(4)} USDT`, 175, currentY);
        } else {
          doc.setTextColor(239, 68, 68);
          doc.text(`${realizedNetPnl.toFixed(4)} USDT`, 175, currentY);
        }
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(200, 200, 205);
        doc.line(14, currentY + 2, 196, currentY + 2);
        currentY += 8;
      }
    }

    if (download) {
      doc.save(`CryptoAI_Sandbox_${selectedStrategy}.pdf`);
      return null;
    } else {
      return doc.output('blob');
    }
  };

  const handleDownloadPDF = () => {
    generatePDF(true);
  };

  const handleSendTelegram = async () => {
    setIsSending(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const pdfBlob = generatePDF(false);
      if (!pdfBlob) {
        setStatusMsg({ type: 'error', text: 'Failed to compile sandbox PDF.' });
        setIsSending(false);
        return;
      }

      const finalStrategyName = selectedStrategy === 'BOLLINGER_RSI'
        ? 'Bollinger Bands + RSI Reversion'
        : selectedStrategy === 'BOLLINGER_RSI_OPT'
        ? 'Bollinger Bands + RSI Reversion (Optimized)'
        : selectedStrategy === 'DOUBLE_EMA'
        ? 'Double EMA Crossover'
        : selectedStrategy === 'DOUBLE_EMA_OPT'
        ? 'Double EMA Crossover (Optimized)'
        : selectedStrategy === 'DOUBLE_EMA_5M'
        ? 'Double EMA 5-Minute'
        : selectedStrategy === 'DOUBLE_EMA_15M'
        ? 'Double EMA 15-Minute'
        : selectedStrategy === 'SUPERTREND_EMA'
        ? 'SuperTrend + 200 EMA'
        : selectedStrategy === 'SUPERTREND_EMA_OPT'
        ? 'SuperTrend + 200 EMA (Optimized)'
        : selectedStrategy === 'STOCH_RSI_MACD'
        ? 'Stochastic RSI + MACD Crossover'
        : selectedStrategy === 'ATR_BREAKOUT'
        ? 'ATR Channel Breakout'
        : selectedStrategy === 'SWING_STRUCTURE'
        ? 'Swing S&R Structure'
        : selectedStrategy === 'MACD_DIVERGENCE'
        ? 'MACD Reversal Divergence'
        : selectedStrategy === 'KDJ_REVERSION'
        ? 'KDJ + StochRSI Reversion'
        : selectedStrategy === 'KDJ_REVERSION_OPT'
        ? 'KDJ + StochRSI Reversion (Optimized)'
        : selectedStrategy === 'FIBONACCI_PULLBACK'
        ? 'EMA Fibonacci Pullback'
        : selectedStrategy === 'ICHIMOKU_CLOUDBREAK'
        ? 'Ichimoku Cloud Breakout'
        : selectedStrategy === 'VWAP_REVERSION'
        ? 'VWAP Volatility Band Reversion'
        : selectedStrategy === 'VWAP_REVERSION_OPT'
        ? 'VWAP Volatility Band Reversion (Optimized)'
        : selectedStrategy === 'COMBINATION_STRATEGIES'
        ? 'Combination Portfolio Dispatcher'
        : selectedStrategy === 'REGIME_ENSEMBLE_PRO'
        ? 'Regime-Aware Ensemble Pro'
        : selectedStrategy === 'RSI_STOCH_EMA_TREND'
        ? 'RSI + Stochastic + EMA Trend'
        : selectedStrategy === 'CMF_BREAKOUT'
        ? 'Chaikin Money Flow Breakout'
        : selectedStrategy === 'HULL_MA_CROSSOVER'
        ? 'Hull Moving Average Crossover'
        : selectedStrategy === 'DONCHIAN_BREAKOUT'
        ? 'Donchian Channel Breakout'
        : selectedStrategy === 'ADX_DI_MOMENTUM'
        ? 'ADX DI Momentum Crossover'
        : 'RSI + MACD Momentum Crossover';

      const file = new File([pdfBlob], `CryptoAI_Sandbox_${selectedStrategy}.pdf`, {
        type: 'application/pdf',
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);

      const res = await fetch('/api/trades/report/send-file', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ type: 'success', text: `Sandbox PDF report for ${finalStrategyName} sent to Telegram!` });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to dispatch Telegram file.' });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMsg({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Section Grid: Header/Tabs and Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left Side: Header & Strategy Tabs (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl space-y-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Strategy Testing Sandbox</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Compare win-rates and simulated balances across independent trading strategies.
            </p>
          </div>
          
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Select Strategy View</span>
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
                onClick={() => setSelectedStrategy('COMBINATION_STRATEGIES')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'COMBINATION_STRATEGIES'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>💼 Combo Strategies</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'COMBINATION_STRATEGIES' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'COMBINATION_STRATEGIES' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('REGIME_ENSEMBLE_PRO')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'REGIME_ENSEMBLE_PRO'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🛡️ Regime Ensemble Pro</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'REGIME_ENSEMBLE_PRO' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'REGIME_ENSEMBLE_PRO' ? 'LIVE' : 'SANDBOX'}
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
                onClick={() => setSelectedStrategy('BOLLINGER_RSI_OPT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'BOLLINGER_RSI_OPT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>↕️ Bollinger + RSI (OPT)</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'BOLLINGER_RSI_OPT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'BOLLINGER_RSI_OPT' ? 'LIVE' : 'SANDBOX'}
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

              <button
                onClick={() => setSelectedStrategy('DOUBLE_EMA_OPT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'DOUBLE_EMA_OPT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🎢 Double EMA (OPT)</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'DOUBLE_EMA_OPT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'DOUBLE_EMA_OPT' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('DOUBLE_EMA_5M')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'DOUBLE_EMA_5M'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🎢 Double EMA 5M</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'DOUBLE_EMA_5M' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'DOUBLE_EMA_5M' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('DOUBLE_EMA_15M')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'DOUBLE_EMA_15M'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🎢 Double EMA 15M</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'DOUBLE_EMA_15M' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'DOUBLE_EMA_15M' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('SUPERTREND_EMA')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'SUPERTREND_EMA'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>⚡ SuperTrend + EMA</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'SUPERTREND_EMA' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'SUPERTREND_EMA' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('SUPERTREND_EMA_OPT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'SUPERTREND_EMA_OPT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>⚡ SuperTrend + EMA (OPT)</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'SUPERTREND_EMA_OPT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'SUPERTREND_EMA_OPT' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('STOCH_RSI_MACD')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'STOCH_RSI_MACD'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🚀 StochRSI + MACD</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'STOCH_RSI_MACD' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'STOCH_RSI_MACD' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('ATR_BREAKOUT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'ATR_BREAKOUT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🎢 ATR Breakout</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'ATR_BREAKOUT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'ATR_BREAKOUT' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('SWING_STRUCTURE')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'SWING_STRUCTURE'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🛡️ Swing S&R Structure</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'SWING_STRUCTURE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'SWING_STRUCTURE' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('MACD_DIVERGENCE')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'MACD_DIVERGENCE'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>📉 MACD Divergence</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'MACD_DIVERGENCE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'MACD_DIVERGENCE' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('KDJ_REVERSION')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'KDJ_REVERSION'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>↕️ KDJ + StochRSI</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'KDJ_REVERSION' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'KDJ_REVERSION' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('KDJ_REVERSION_OPT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'KDJ_REVERSION_OPT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>↕️ KDJ + StochRSI (OPT)</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'KDJ_REVERSION_OPT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'KDJ_REVERSION_OPT' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('FIBONACCI_PULLBACK')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'FIBONACCI_PULLBACK'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🎢 Fib Pullback</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'FIBONACCI_PULLBACK' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'FIBONACCI_PULLBACK' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('ICHIMOKU_CLOUDBREAK')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'ICHIMOKU_CLOUDBREAK'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>☁️ Ichimoku Cloud</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'ICHIMOKU_CLOUDBREAK' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'ICHIMOKU_CLOUDBREAK' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('VWAP_REVERSION')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'VWAP_REVERSION'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>⚡ VWAP Reversion</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'VWAP_REVERSION' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'VWAP_REVERSION' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('VWAP_REVERSION_OPT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'VWAP_REVERSION_OPT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>⚡ VWAP Reversion (OPT)</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'VWAP_REVERSION_OPT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'VWAP_REVERSION_OPT' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('RSI_STOCH_EMA_TREND')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'RSI_STOCH_EMA_TREND'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>📈 RSI + Stoch + EMA</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'RSI_STOCH_EMA_TREND' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'RSI_STOCH_EMA_TREND' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('CMF_BREAKOUT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'CMF_BREAKOUT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>💰 CMF Breakout</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'CMF_BREAKOUT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'CMF_BREAKOUT' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('HULL_MA_CROSSOVER')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'HULL_MA_CROSSOVER'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>🌊 Hull MA Crossover</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'HULL_MA_CROSSOVER' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'HULL_MA_CROSSOVER' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('DONCHIAN_BREAKOUT')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'DONCHIAN_BREAKOUT'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>📦 Donchian Breakout</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'DONCHIAN_BREAKOUT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'DONCHIAN_BREAKOUT' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>

              <button
                onClick={() => setSelectedStrategy('ADX_DI_MOMENTUM')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  selectedStrategy === 'ADX_DI_MOMENTUM'
                    ? 'bg-emerald-950/20 border-emerald-500/80 text-emerald-400 shadow-md shadow-emerald-500/5 font-extrabold'
                    : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>💥 ADX DI Momentum</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${activeStrategySetting === 'ADX_DI_MOMENTUM' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900 text-zinc-650'}`}>
                  {activeStrategySetting === 'ADX_DI_MOMENTUM' ? 'LIVE' : 'SANDBOX'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Leaderboard Panel (1/3 width) */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-5 rounded-3xl flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Strategy Leaderboard</span>
            </span>
            <span className="text-[9px] font-extrabold text-zinc-500 uppercase">by Balance</span>
          </div>

          {/* Total Combined Simulated Balance */}
          {(() => {
            const totalSandboxBalance = leaderboard.reduce((sum, item) => sum + item.balance, 0);
            const initialSandboxBalance = leaderboard.length * 100.0;
            const profitOrLoss = totalSandboxBalance - initialSandboxBalance;
            const isProfit = profitOrLoss >= 0;
            return (
              <div className="p-3.5 bg-zinc-950/50 border border-zinc-900 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Total Combined Balance</span>
                  <span className="text-[10px] font-medium text-zinc-400">All {leaderboard.length} Strategies</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-extrabold text-zinc-200 text-sm block">
                    {totalSandboxBalance.toFixed(2)} USDT
                  </span>
                  <span className={`text-[9px] font-extrabold font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}{profitOrLoss.toFixed(2)} USDT
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="space-y-2 flex-grow overflow-y-auto max-h-[480px] pr-1">
            {leaderboard.map((item, idx) => {
              const displayName = item.strategy === 'RSI_MACD'
                ? 'RSI + MACD'
                : item.strategy === 'BOLLINGER_RSI'
                ? 'Bollinger + RSI'
                : item.strategy === 'DOUBLE_EMA'
                ? 'Double EMA'
                : item.strategy === 'DOUBLE_EMA_OPT'
                ? 'Double EMA (OPT)'
                : item.strategy === 'DOUBLE_EMA_5M'
                ? 'Double EMA 5M'
                : item.strategy === 'DOUBLE_EMA_15M'
                ? 'Double EMA 15M'
                : item.strategy === 'SUPERTREND_EMA'
                ? 'SuperTrend + EMA'
                : item.strategy === 'SUPERTREND_EMA_OPT'
                ? 'SuperTrend + EMA (OPT)'
                : item.strategy === 'STOCH_RSI_MACD'
                ? 'StochRSI + MACD'
                : item.strategy === 'SWING_STRUCTURE'
                ? 'Swing Structure'
                : item.strategy === 'ATR_BREAKOUT'
                ? 'ATR Breakout'
                : item.strategy === 'MACD_DIVERGENCE'
                ? 'MACD Divergence'
                : item.strategy === 'KDJ_REVERSION'
                ? 'KDJ Reversion'
                : item.strategy === 'KDJ_REVERSION_OPT'
                ? 'KDJ Reversion (OPT)'
                : item.strategy === 'FIBONACCI_PULLBACK'
                ? 'Fib Pullback'
                : item.strategy === 'ICHIMOKU_CLOUDBREAK'
                ? 'Ichimoku Cloud'
                : item.strategy === 'VWAP_REVERSION'
                ? 'VWAP Reversion'
                : item.strategy === 'VWAP_REVERSION_OPT'
                ? 'VWAP Reversion (OPT)'
                : item.strategy === 'COMBINATION_STRATEGIES'
                ? 'Combo Strategies'
                : item.strategy === 'REGIME_ENSEMBLE_PRO'
                ? 'Regime Ensemble Pro'
                : item.strategy === 'RSI_STOCH_EMA_TREND'
                ? 'RSI + Stoch + EMA'
                : item.strategy === 'CMF_BREAKOUT'
                ? 'CMF Breakout'
                : item.strategy === 'HULL_MA_CROSSOVER'
                ? 'Hull MA Crossover'
                : item.strategy === 'DONCHIAN_BREAKOUT'
                ? 'Donchian Breakout'
                : item.strategy === 'ADX_DI_MOMENTUM'
                ? 'ADX DI Momentum'
                : 'Unknown';

              const isLive = item.strategy === activeStrategySetting;
              const isSelected = item.strategy === selectedStrategy;
              
              let badgeColor = "text-zinc-400 bg-zinc-900 border-zinc-800";
              if (idx === 0) badgeColor = "text-amber-400 bg-amber-950/20 border-amber-800/50";
              else if (idx === 1) badgeColor = "text-zinc-300 bg-zinc-800/40 border-zinc-700/50";
              else if (idx === 2) badgeColor = "text-amber-600 bg-amber-900/10 border-amber-800/20";

              return (
                <div 
                  key={item.strategy}
                  onClick={() => setSelectedStrategy(item.strategy as any)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-[11px] cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-300' 
                      : 'bg-zinc-950/20 border-zinc-900/40 hover:bg-zinc-900/10 hover:border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 flex items-center justify-center text-[9px] font-extrabold border rounded-lg ${badgeColor}`}>
                      #{idx + 1}
                    </span>
                    <span className="font-bold flex items-center gap-1">
                      {displayName}
                      {isLive && <span className="text-[7px] px-1 bg-emerald-950 border border-emerald-900/40 text-emerald-400 rounded">LIVE</span>}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-extrabold ${item.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {item.balance.toFixed(2)} USDT
                    </div>
                    <div className="text-[9px] text-zinc-500 font-medium">
                      WR: {item.winRate.toFixed(0)}% ({item.wins}W-{item.losses}L)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Report Center Actions Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Summary Report Center</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Analyze, print, download, or share trade statistics for the selected strategy.
          </p>
        </div>

        {/* Actions Row */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer select-none border border-zinc-800 bg-zinc-950/30 px-3.5 py-2.5 rounded-xl transition-all">
            <input
              type="checkbox"
              checked={includePairwise}
              onChange={(e) => setIncludePairwise(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-500 rounded border-zinc-750 bg-zinc-900 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Include Pair-wise Summary</span>
          </label>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-all duration-200 cursor-pointer"
            title="Compile & Download PDF Report"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handleSendTelegram}
            disabled={isSending}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-900/50 rounded-xl text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Send PDF report directly to Telegram channel"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Send Telegram</span>
          </button>
        </div>
      </div>

      {statusMsg.text && (
        <div
          className={`p-3.5 border rounded-2xl text-xs font-semibold ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
              : 'bg-red-950/20 border-red-900/50 text-red-400'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

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
                onClick={() => setRangeQuick('2days')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === 'none' && startDate === new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 2 Days
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('3days')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === 'none' && startDate === new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 3 Days
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('5days')}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  hourlyFilter === 'none' && startDate === new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]
                    ? 'bg-emerald-500 border-emerald-600 text-zinc-950 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                Last 5 Days
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {/* Simulated Wallet Balance */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Simulated Balance
            </span>
            <span className="p-2 bg-blue-950/30 border border-blue-900/50 rounded-xl text-blue-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100">
              {currentBalance.toFixed(2)}
              <span className="text-sm font-medium text-zinc-500 ml-1.5">USDT</span>
            </h3>
            <p className="text-xs text-zinc-450 mt-2 font-semibold">
              {selectedStrategy !== activeStrategySetting 
                ? 'Sandbox Account (Starts: 100 USDT)'
                : 'Live Account Baseline'}
            </p>
          </div>
        </div>

        {/* Total Net P&L */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className={`text-xs font-bold uppercase tracking-wider ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Total Net P&L
            </span>
            <span className={`p-2 rounded-xl border ${totalPnl >= 0 ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border-red-900/50 text-red-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}
              {totalPnl.toFixed(4)}
              <span className="text-sm font-medium ml-1.5">USDT</span>
            </h3>
            <p className="text-xs text-zinc-450 mt-2 font-semibold">
              Closed realized + Open floating
            </p>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-purple-400">
              Win Rate %
            </span>
            <span className="p-2 bg-purple-950/30 border border-purple-900/50 rounded-xl text-purple-400">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-purple-400">
              {winRate.toFixed(1)}%
            </h3>
            <p className="text-xs text-zinc-450 mt-2 font-semibold">
              Wins: {wins} | Losses: {losses}
            </p>
          </div>
        </div>

        {/* Total Trades */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Total Closed Trades
            </span>
            <span className="p-2 bg-zinc-950/30 border border-zinc-800 rounded-xl text-zinc-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-200">
              {totalTrades}
              <span className="text-sm font-medium text-zinc-500 ml-1.5">trades</span>
            </h3>
            <p className="text-xs text-zinc-450 mt-2 font-semibold">
              Realized completed trades count
            </p>
          </div>
        </div>

        {/* Today's P&L */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className={`text-xs font-bold uppercase tracking-wider ${todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Today's P&L
            </span>
            <span className={`p-2 rounded-xl border ${todayPnl >= 0 ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border-red-900/50 text-red-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {todayPnl >= 0 ? '+' : ''}
              {todayPnl.toFixed(4)}
              <span className="text-sm font-medium ml-1.5">USDT</span>
            </h3>
            <p className="text-xs text-zinc-450 mt-2 font-semibold">
              Closed trades today (Riyadh time)
            </p>
          </div>
        </div>

        {/* Yesterday's P&L */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden group hover:border-zinc-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className={`text-xs font-bold uppercase tracking-wider ${yesterdayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Yesterday's P&L
            </span>
            <span className={`p-2 rounded-xl border ${yesterdayPnl >= 0 ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border-red-900/50 text-red-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${yesterdayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {yesterdayPnl >= 0 ? '+' : ''}
              {yesterdayPnl.toFixed(4)}
              <span className="text-sm font-medium ml-1.5">USDT</span>
            </h3>
            <p className="text-xs text-zinc-450 mt-2 font-semibold">
              Closed trades yesterday (Riyadh time)
            </p>
          </div>
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

      {/* Two Column Grid for Completed Trades and Strategy Pairs Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Trade Execution Ledger */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4 lg:col-span-8">
          <h3 className="text-md font-bold text-zinc-200 pb-2 border-b border-zinc-800/50 flex items-center justify-between">
            <span>Completed Trade Ledger (Paper Sandbox)</span>
            <span className="px-2 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] font-bold text-zinc-400">
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
                    <th className="pb-3 text-right">Simulated Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-xs">
                  {(() => {
                    let running = 100.0;
                    const tradesWithBalance = trades.map((t) => {
                      running += (t.pnl || 0);
                      return { ...t, runningBalance: running };
                    });
                    const displayTrades = [...tradesWithBalance].reverse();
                    return displayTrades.map((t) => {
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
                          <td className="py-3.5 text-right font-mono font-bold text-zinc-300">
                            {t.runningBalance.toFixed(2)} USDT
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Strategy Pairs Configuration */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4 lg:col-span-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
            <h3 className="text-md font-bold text-zinc-200">Pairs Controller</h3>
            <button
              onClick={handleSavePairsConfig}
              disabled={isSavingConfig || !dbSettings}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all"
            >
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            Tick or untick pairs to enable/disable them for <b>{selectedStrategy}</b>. Shows Wins / Losses for the selected date range.
          </p>

          <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2 divide-y divide-zinc-850">
            {dbSettings?.pairs?.map((p: string) => {
              const isChecked = !!localPairsConfig[p];
              const stats = pairStats[p] || { wins: 0, losses: 0 };
              
              return (
                <div key={p} className="flex justify-between items-center py-2.5 first:pt-0">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setLocalPairsConfig(prev => ({ ...prev, [p]: !prev[p] }))}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className={`text-xs font-bold ${isChecked ? 'text-zinc-200' : 'text-zinc-500 line-through'}`}>
                      {p}
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
                    <span className="text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-1.5 py-0.5 rounded">
                      {stats.wins}W
                    </span>
                    <span className="text-red-400 bg-red-950/20 border border-red-900/30 px-1.5 py-0.5 rounded">
                      {stats.losses}L
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
