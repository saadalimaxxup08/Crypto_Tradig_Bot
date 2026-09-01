'use client';

import { useState, useEffect } from 'react';
import { FileText, Calendar, Download, Send, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
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
  deriv_status?: 'WON' | 'LOST' | 'OPEN';
  duration?: number;
  duration_unit?: string;
}

const STRATEGY_NAMES: Record<string, string> = {
  FOREX_15M_MTF: 'Forex 15m MTF Crossover v1',
  FOREX_15M_MTF_V2: 'Forex 15m MTF Crossover v2',
  FOREX_30M_MTF_V3: 'Forex 30m MTF Crossover v1.1',
};

const SYMBOL_NAMES: Record<string, string> = {
  frxEURUSD: 'EUR/USD',
  frxGBPUSD: 'GBP/USD',
  frxUSDJPY: 'USD/JPY',
  frxAUDUSD: 'AUD/USD',
  frxUSDCAD: 'USD/CAD',
  frxUSDCHF: 'USD/CHF',
  frxAUDJPY: 'AUD/JPY',
  frxEURJPY: 'EUR/JPY',
  frxGBPJPY: 'GBP/JPY',
  frxXAUUSD: 'Gold / USD',
  frxXAGUSD: 'Silver / USD',
  cryBTCUSD: 'BTC/USD',
  cryETHUSD: 'ETH/USD',
  R_10: 'Volatility 10 Index',
  R_25: 'Volatility 25 Index',
  R_50: 'Volatility 50 Index',
  R_75: 'Volatility 75 Index',
  R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  BOOM500: 'Boom 500 Index',
  BOOM1000: 'Boom 1000 Index',
  CRASH500: 'Crash 500 Index',
  CRASH1000: 'Crash 1000 Index',
  JD50: 'Jump 50 Index',
  stpRNG: 'Step Index',
  RB100: 'Range Break 100',
  RB200: 'Range Break 200',
  stpRNG2: 'Step Index 200',
  stpRNG3: 'Step Index 300',
  stpRNG4: 'Step Index 400',
  stpRNG5: 'Step Index 500'
};

function getDisplaySymbolName(symbol: string) {
  const name = SYMBOL_NAMES[symbol];
  return name ? `${name} (${symbol})` : symbol;
}

export default function DerivSummaryPage() {
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
  const [rawTrades, setRawTrades] = useState<Trade[]>([]);
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [showPaperTrades, setShowPaperTrades] = useState(true);
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | '1m' | '5m' | '15m' | '30m'>('all');

  // Default date ranges setup
  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    setStartDate(formatDateStr(sevenDaysAgo));
    setEndDate(formatDateStr(today));
  }, []);

  const applyFilters = (allTrades: Trade[]) => {
    // 1. Filter only live trades unless showPaperTrades is enabled
    let filteredTrades = allTrades.filter((t) => showPaperTrades ? true : !t.is_paper);

    // 2. Filter by selected Pairs (if any are selected)
    if (selectedPairs.length > 0) {
      filteredTrades = filteredTrades.filter((t) => selectedPairs.includes(t.pair));
    }

    // 3. Filter by selected Strategies (if any are selected)
    if (selectedStrategies.length > 0) {
      filteredTrades = filteredTrades.filter((t) => t.strategy && selectedStrategies.includes(t.strategy));
    }

    // 3.5 Filter by timeframe / duration
    if (timeframeFilter !== 'all') {
      filteredTrades = filteredTrades.filter((t) => {
        const durStr = `${t.duration || 15}${t.duration_unit || 'm'}`;
        return durStr === timeframeFilter;
      });
    }

    // 4. Filter by date/hours cutoff
    const filteredClosed = filteredTrades.filter((t) => {
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

    // Sort descending by close time (latest trades on top)
    filteredClosed.sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
    setTrades(filteredClosed);

    // Filter active trades
    const active = filteredTrades.filter((t) => t.status === 'OPEN');
    setActiveTrades(active);
  };

  const fetchSummaryTrades = async () => {
    setIsLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const res = await fetch(`/api/deriv/trades`);
      const data = await res.json();
      if (res.ok && data.success) {
        const rawList = data.detailedTrades || [];
        const detailedTrades: Trade[] = rawList.map((t: any) => {
          let dur = t.duration;
          let unit = t.duration_unit || 'm';

          if (!dur && t.created_at && t.closed_at) {
            const diffMs = new Date(t.closed_at).getTime() - new Date(t.created_at).getTime();
            const mins = Math.round(diffMs / 60000);
            dur = mins > 0 ? mins : 15;
          } else if (!dur) {
            dur = 15;
          }

          return {
            id: t.id,
            timestamp: t.created_at,
            pair: t.symbol,
            direction: t.contract_type === 'CALL' ? 'LONG' : 'SHORT',
            entry_price: t.entry_price || 0,
            exit_price: t.exit_price || 0,
            amount: t.stake || 1.0,
            status: t.status === 'OPEN' ? 'OPEN' : 'CLOSED',
            pnl: t.pnl || 0,
            closed_at: t.closed_at,
            leverage: 1,
            margin: t.stake || 1.0,
            strategy: t.strategy,
            is_paper: t.is_paper,
            deriv_status: t.status,
            duration: dur,
            duration_unit: unit
          };
        });
        setRawTrades(detailedTrades);
        setLivePrices(data.livePrices || {});
        applyFilters(detailedTrades);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryTrades();
  }, []);

  useEffect(() => {
    applyFilters(rawTrades);
  }, [startDate, endDate, hourlyFilter, selectedPairs, selectedStrategies, showPaperTrades, rawTrades, timeframeFilter]);

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

  // Compile calculations
  const totalTrades = trades.length;
  const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const netPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  // PDF Generator Engine (using jsPDF)
  const generatePDF = (download: boolean = true) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header Dark Banner Branding
    doc.setFillColor(15, 15, 20); // Dark carbon color
    doc.rect(0, 0, 210, 32, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("Deriv VIP Options Terminal", 14, 13);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 165);
    doc.text("Performance Summary Report & Verified Options Ledger (Jeddah Time)", 14, 19);
    
    const tfLabel = timeframeFilter !== 'all' ? ` | Timeframe: ${timeframeFilter}` : '';
    const dateRangeStr = `Period: ${new Date(startDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })} to ${new Date(endDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })}${tfLabel}`;
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

    // Card 3: Total P&L
    doc.rect(104, cardY, 44, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("NET CUMULATIVE P&L", 107, cardY + 5);
    doc.setFontSize(11);
    if (netPnl >= 0) {
      doc.setTextColor(16, 185, 129);
      doc.text(`+${netPnl.toFixed(4)}`, 107, cardY + 12);
    } else {
      doc.setTextColor(239, 68, 68);
      doc.text(`${netPnl.toFixed(4)}`, 107, cardY + 12);
    }
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("USD (net values)", 107, cardY + 16);

    // Card 4: Avg Trade Return
    doc.rect(152, cardY, 44, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("AVERAGE RETURN", 155, cardY + 5);
    doc.setFontSize(11);
    const avgReturn = totalTrades > 0 ? netPnl / totalTrades : 0;
    if (avgReturn >= 0) {
      doc.setTextColor(16, 185, 129);
      doc.text(`+${avgReturn.toFixed(4)}`, 155, cardY + 12);
    } else {
      doc.setTextColor(239, 68, 68);
      doc.text(`${avgReturn.toFixed(4)}`, 155, cardY + 12);
    }
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("USD per contract", 155, cardY + 16);

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
      doc.text("Pair / Asset", 54, currentY);
      doc.text("Type", 90, currentY);
      doc.text("Entry Price", 110, currentY);
      doc.text("Live Price", 138, currentY);
      doc.text("Duration", 165, currentY);
      
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      activeTrades.forEach((t) => {
        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }
        const curPrice = livePrices[t.pair] || t.entry_price;
        const entryTime = new Date(t.timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) + ' ' + new Date(t.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false });
        
        const timeInMarket = new Date(t.timestamp);
        const durationMs = Date.now() - timeInMarket.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

        doc.setTextColor(30, 30, 35);
        doc.text(entryTime, 17, currentY);
        doc.text(getDisplaySymbolName(t.pair).split(' (')[0], 54, currentY);
        
        if (t.direction === 'LONG') {
          doc.setTextColor(16, 185, 129);
          doc.setFont('helvetica', 'bold');
          doc.text("RISE (CALL)", 90, currentY);
        } else {
          doc.setTextColor(239, 68, 68);
          doc.setFont('helvetica', 'bold');
          doc.text("FALL (PUT)", 90, currentY);
        }
        doc.setFont('helvetica', 'normal');
        
        doc.setTextColor(80, 80, 85);
        doc.text(t.entry_price.toFixed(4), 110, currentY);
        doc.text(curPrice.toFixed(4), 138, currentY);
        doc.text(durationStr, 165, currentY);

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
    doc.text("Close Time", 16, currentY);
    doc.text("Pair / Asset", 48, currentY);
    doc.text("Type", 82, currentY);
    doc.text("Duration", 100, currentY);
    doc.text("Entry spot", 118, currentY);
    doc.text("Exit spot", 138, currentY);
    doc.text("Stake", 158, currentY);
    doc.text("Net return", 176, currentY);
    
    currentY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    trades.forEach((t) => {
      if (currentY > 275) {
        doc.addPage();
        currentY = 20;
      }
      const closeTime = new Date(t.closed_at).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) + ' ' + new Date(t.closed_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false });
      const displayName = getDisplaySymbolName(t.pair).split(' (')[0];
      const durStr = `${t.duration || 15}${t.duration_unit || 'm'}`;

      doc.setTextColor(30, 30, 35);
      doc.text(closeTime, 16, currentY);
      doc.text(displayName, 48, currentY);
      
      if (t.direction === 'LONG') {
        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.text("CALL", 82, currentY);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.text("PUT", 82, currentY);
      }
      doc.setFont('helvetica', 'normal');

      doc.setTextColor(80, 80, 85);
      doc.text(durStr, 100, currentY);
      doc.text(t.entry_price.toFixed(4), 118, currentY);
      doc.text(t.exit_price ? t.exit_price.toFixed(4) : 'N/A', 138, currentY);
      doc.text(`$${t.amount.toFixed(1)}`, 158, currentY);

      if (t.pnl > 0) {
        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.text(`+${t.pnl.toFixed(2)} USD`, 176, currentY);
      } else if (t.pnl < 0) {
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.text(`${t.pnl.toFixed(2)} USD`, 176, currentY);
      } else {
        doc.setTextColor(120, 120, 125);
        doc.text("0.00 USD", 176, currentY);
      }
      doc.setFont('helvetica', 'normal');

      doc.setDrawColor(240, 240, 245);
      doc.line(14, currentY + 1.5, 196, currentY + 1.5);
      currentY += 5.5;
    });

    currentY += 3;

    // 5. Optional Pairwise Performance Summary page / table
    if (includePairwise) {
      const pairStats: Record<string, { total: number; wins: number; pnl: number }> = {};
      trades.forEach((t) => {
        if (!pairStats[t.pair]) {
          pairStats[t.pair] = { total: 0, wins: 0, pnl: 0 };
        }
        pairStats[t.pair].total += 1;
        if (t.pnl > 0) pairStats[t.pair].wins += 1;
        pairStats[t.pair].pnl += t.pnl;
      });

      const sortedPairs = Object.entries(pairStats).sort((a, b) => b[1].pnl - a[1].pnl);
      const allConfiguredPairs = Array.from(new Set(rawTrades.map((t) => t.pair)));
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

        sortedPairs.forEach(([pair, stats]) => {
          if (currentY > 275) {
            doc.addPage();
            currentY = 20;
          }

          const wr = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
          const ls = stats.total - stats.wins;

          doc.setTextColor(30, 30, 35);
          doc.text(getDisplaySymbolName(pair).split(' (')[0], 17, currentY);
          doc.text(stats.total.toString(), 64, currentY);
          doc.text(`${stats.wins}W - ${ls}L`, 100, currentY);
          doc.text(`${wr.toFixed(1)}%`, 140, currentY);

          if (stats.pnl >= 0) {
            doc.setTextColor(16, 185, 129);
            doc.setFont('helvetica', 'bold');
            doc.text(`+${stats.pnl.toFixed(2)} USD`, 175, currentY);
          } else {
            doc.setTextColor(239, 68, 68);
            doc.setFont('helvetica', 'bold');
            doc.text(`${stats.pnl.toFixed(2)} USD`, 175, currentY);
          }
          doc.setFont('helvetica', 'normal');

          doc.setDrawColor(240, 240, 245);
          doc.line(14, currentY + 1.5, 196, currentY + 1.5);
          currentY += 5.5;
        });

        nonTradedPairs.forEach((pair) => {
          if (currentY > 275) {
            doc.addPage();
            currentY = 20;
          }

          doc.setTextColor(140, 140, 145);
          doc.text(getDisplaySymbolName(pair).split(' (')[0], 17, currentY);
          doc.text("0", 64, currentY);
          doc.text("0W - 0L", 100, currentY);
          doc.text("0.0%", 140, currentY);
          doc.text("0.00 USD", 175, currentY);

          doc.setDrawColor(240, 240, 245);
          doc.line(14, currentY + 1.5, 196, currentY + 1.5);
          currentY += 5.5;
        });

        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFillColor(250, 250, 252);
        doc.rect(14, currentY - 4, 182, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 35);
        doc.text("TOTAL CUMULATIVE P&L", 17, currentY);
        
        if (netPnl >= 0) {
          doc.setTextColor(16, 185, 129);
          doc.text(`+${netPnl.toFixed(2)} USD`, 175, currentY);
        } else {
          doc.setTextColor(239, 68, 68);
          doc.text(`${netPnl.toFixed(2)} USD`, 175, currentY);
        }
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(200, 200, 205);
        doc.line(14, currentY + 2, 196, currentY + 2);
        currentY += 8;
      }
    }

    const tfFilePart = timeframeFilter !== 'all' ? `_${timeframeFilter}` : '';
    if (download) {
      doc.save(`Deriv_Report_${startDate}_to_${endDate}${tfFilePart}.pdf`);
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
        setStatusMsg({ type: 'error', text: 'Failed to compile report PDF.' });
        setIsSending(false);
        return;
      }

      const tfFilePart = timeframeFilter !== 'all' ? `_${timeframeFilter}` : '';
      const file = new File([pdfBlob], `Deriv_Report_${startDate}_to_${endDate}${tfFilePart}.pdf`, {
        type: 'application/pdf',
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('timeframe', timeframeFilter);

      const res = await fetch('/api/deriv/trades/report/send-file', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ type: 'success', text: 'PDF report successfully sent to Telegram!' });
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
      <style jsx global>{`
        @media print {
          aside, header, .no-print, button, select, input {
            display: none !important;
          }
          body, main, .max-w-5xl {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          .print-card {
            border: 1px solid #ddd !important;
            background: #fafafa !important;
            color: black !important;
            border-radius: 8px !important;
            box-shadow: none !important;
          }
          .text-emerald-400 {
            color: #047857 !important;
          }
          .text-red-400 {
            color: #b91c1c !important;
          }
          .text-zinc-400, .text-zinc-500 {
            color: #555 !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border-bottom: 1px solid #ddd !important;
            color: black !important;
          }
          .print-header {
            display: block !important;
            border-bottom: 2px solid black !important;
            padding-bottom: 10px !important;
            margin-bottom: 20px !important;
          }
        }
      `}</style>

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl no-print">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Deriv Summary Report Center</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Analyze, print, download, or share Deriv trade statistics across customizable date ranges.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer select-none border border-zinc-800 bg-zinc-950/30 px-3.5 py-2.5 rounded-xl transition-all">
            <input
              type="checkbox"
              checked={showPaperTrades}
              onChange={(e) => setShowPaperTrades(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-500 rounded border-zinc-750 bg-zinc-900 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Show Demo (Paper) Trades</span>
          </label>

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

      {/* Date Pickers & Quick Filters */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Start Date</span>
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
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">End Date</span>
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
      </div>

      {/* Multi-Select Filters */}
      {rawTrades.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 no-print">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block">Trading Pairs</span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {selectedPairs.length === 0 ? 'Showing All Pairs (Overall)' : `Filtered to ${selectedPairs.length} selected pair(s)`}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPairs(Array.from(new Set(rawTrades.filter(t => showPaperTrades ? true : !t.is_paper).map(t => t.pair))).sort())}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 uppercase tracking-wider font-semibold border border-zinc-800 bg-zinc-950/20 px-2 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedPairs([])}
                  className="text-[10px] text-zinc-500 hover:text-zinc-350 uppercase tracking-wider font-semibold border border-zinc-800 bg-zinc-950/20 px-2 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Select None (All)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {Array.from(new Set(rawTrades.filter(t => showPaperTrades ? true : !t.is_paper).map((t) => t.pair))).sort().map((pair) => {
                const isSelected = selectedPairs.includes(pair);
                return (
                  <button
                    key={pair}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPairs(selectedPairs.filter(p => p !== pair));
                      } else {
                        setSelectedPairs([...selectedPairs, pair]);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400 font-extrabold shadow-md'
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-3 h-3 pointer-events-none accent-emerald-500 rounded border-zinc-700 focus:ring-0"
                    />
                    <span>{getDisplaySymbolName(pair).split(' (')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-805/30 border-zinc-800 lg:border-t-0 lg:border-l lg:border-zinc-800 pt-4 lg:pt-0 lg:pl-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block">Trading Strategies</span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {selectedStrategies.length === 0 ? 'Showing All Strategies (Overall)' : `Filtered to ${selectedStrategies.length} selected strategy(s)`}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedStrategies(Array.from(new Set(rawTrades.filter(t => showPaperTrades ? true : !t.is_paper).map(t => t.strategy).filter(Boolean))) as string[])}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 uppercase tracking-wider font-semibold border border-zinc-800 bg-zinc-950/20 px-2 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedStrategies([])}
                  className="text-[10px] text-zinc-500 hover:text-zinc-350 uppercase tracking-wider font-semibold border border-zinc-800 bg-zinc-950/20 px-2 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Select None (All)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {Array.from(new Set(rawTrades.filter(t => showPaperTrades ? true : !t.is_paper).map((t) => t.strategy).filter(Boolean))).sort().map((strategy) => {
                const isSelected = selectedStrategies.includes(strategy as string);
                const displayName = STRATEGY_NAMES[strategy as string] || strategy;
                return (
                  <button
                    key={strategy}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedStrategies(selectedStrategies.filter(s => s !== strategy));
                      } else {
                        setSelectedStrategies([...selectedStrategies, strategy as string]);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-950/20 border-blue-500/40 text-blue-400 font-extrabold shadow-md'
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-3 h-3 pointer-events-none accent-blue-500 rounded border-zinc-700 focus:ring-0"
                    />
                    <span className="truncate max-w-[180px]">{displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print-header text-black">
        <h1 className="text-xl font-bold uppercase tracking-wider">Deriv VIP Options Terminal</h1>
        <p className="text-xs text-gray-600 mt-1">
          Trading Performance Summary: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
        </p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Trades</span>
          <h3 className="text-2xl font-extrabold text-zinc-200 mt-2">{totalTrades}</h3>
          <p className="text-[9px] text-zinc-500 mt-1">Closed positions in range</p>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-purple-400">Win Rate %</span>
          <h3 className="text-2xl font-extrabold text-purple-400 mt-2">{winRate.toFixed(1)}%</h3>
          <p className="text-[9px] text-zinc-500 mt-1">Wins: {wins} | Losses: {losses}</p>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Total P&L</span>
          <h3 className={`text-2xl font-extrabold mt-2 ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netPnl >= 0 ? '+' : ''}
            {netPnl.toFixed(2)}
            <span className="text-xs font-medium ml-1">USD</span>
          </h3>
          <p className="text-[9px] text-zinc-500 mt-1">Realized value after fees</p>
        </div>

        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          {(() => {
            const startOfToday = new Date();
            // Align with Jeddah Time (GMT+3)
            startOfToday.setUTCHours(-3, 0, 0, 0);
            const dailyPnl = trades
              .filter((t) => t.closed_at && new Date(t.closed_at) >= startOfToday)
              .reduce((sum, t) => sum + (t.pnl || 0), 0);
            return (
              <>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Daily P&L</span>
                <h3 className={`text-2xl font-extrabold mt-2 ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyPnl >= 0 ? '+' : ''}
                  {dailyPnl.toFixed(2)}
                  <span className="text-xs font-medium ml-1">USD</span>
                </h3>
                <p className="text-[9px] text-zinc-500 mt-1">Closed trades closed today</p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Timeframe Performance Breakdown Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>⏱️ Timeframe Performance Breakdown</span>
          </span>
          <span className="text-[10px] text-zinc-500 font-medium">Results separated by trade duration (Click to filter)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
          {[
            { label: '1 Minute', value: '1m', badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-950/10' },
            { label: '5 Minutes', value: '5m', badgeColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/10' },
            { label: '15 Minutes', value: '15m', badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/10' },
            { label: '30 Minutes', value: '30m', badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-950/10' },
          ].map(({ label, value, badgeColor }) => {
            const tfTrades = rawTrades.filter(t => {
              if (t.status !== 'CLOSED') return false;
              const durStr = `${t.duration || 15}${t.duration_unit || 'm'}`;
              return durStr === value;
            });
            const tfWins = tfTrades.filter(t => (t.pnl || 0) > 0).length;
            const tfLosses = tfTrades.filter(t => (t.pnl || 0) <= 0).length;
            const tfTotal = tfTrades.length;
            const tfWr = tfTotal > 0 ? (tfWins / tfTotal) * 100 : 0;
            const tfPnl = tfTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            const isSelected = timeframeFilter === value;

            return (
              <div
                key={value}
                onClick={() => setTimeframeFilter(isSelected ? 'all' : (value as any))}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 border-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.02]'
                    : 'bg-[#0c0c0f]/60 backdrop-blur-xl border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${badgeColor}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono font-medium">
                    {tfTotal} trade(s)
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-lg font-extrabold text-zinc-200">{tfTotal > 0 ? `${tfWr.toFixed(1)}%` : '0%'}</span>
                    <span className="text-[9px] text-zinc-500 block">Win Rate ({tfWins}W - {tfLosses}L)</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold font-mono ${tfPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tfPnl >= 0 ? '+' : ''}{tfPnl.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-zinc-500 block">Net P&L (USD)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Running Positions Section */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4 print-card">
        <h3 className="text-md font-bold text-zinc-200 pb-2 border-b border-zinc-800/50 flex items-center justify-between">
          <span>Active Running Positions</span>
          <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400">
            {activeTrades.length} positions
          </span>
        </h3>

        {activeTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-zinc-800/80 rounded-2xl">
            <p className="text-xs text-zinc-500 font-medium">No active positions currently running in the market.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-3">Open Time</th>
                  <th className="pb-3">Pair / Asset</th>
                  <th className="pb-3 text-center">Direction</th>
                  <th className="pb-3 text-right">Entry Price</th>
                  <th className="pb-3 text-right">Live Price</th>
                  <th className="pb-3 text-center">Time In Market</th>
                  <th className="pb-3 text-right">Stake</th>
                  <th className="pb-3 text-right">Floating P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-xs">
                {activeTrades.map((t) => {
                  const currentPrice = livePrices[t.pair] || t.entry_price;
                  const isProfit = t.pnl >= 0;
                  
                  const entryTime = new Date(t.timestamp);
                  const durationMs = Date.now() - entryTime.getTime();
                  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                  const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                  const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

                  return (
                    <tr key={t.id} className="hover:bg-zinc-900/10">
                      <td className="py-3.5 font-mono text-zinc-400">{entryTime.toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}</td>
                      <td className="py-3.5 font-bold text-zinc-200">{getDisplaySymbolName(t.pair).split(' (')[0]}</td>
                      <td className="py-3.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase ${
                            t.direction === 'LONG'
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                              : 'bg-red-950/20 border-red-900/50 text-red-400'
                          }`}
                        >
                          {t.direction === 'LONG' ? 'RISE (CALL)' : 'FALL (PUT)'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">{t.entry_price.toFixed(4)}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-200 font-bold">{currentPrice.toFixed(4)}</td>
                      <td className="py-3.5 text-center text-zinc-300 font-medium">{durationStr}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">
                        {`$${t.amount.toFixed(1)}`}
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold">
                        <div
                          className={`flex items-center justify-end gap-0.5 ${
                            isProfit ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          <span>
                            {isProfit ? '+' : ''}
                            {t.pnl.toFixed(2)} USD
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Ledger List with Timeframe Separation */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4 print-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/50">
          <div>
            <h3 className="text-md font-bold text-zinc-200">Trades Execution Ledger</h3>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
              Showing {trades.length} trade(s) {timeframeFilter !== 'all' ? `• Filtered to ${timeframeFilter} Timeframe` : '• All Timeframes'}
            </p>
          </div>

          {/* Timeframe Separation Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl no-print overflow-x-auto">
            <button
              type="button"
              onClick={() => setTimeframeFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                timeframeFilter === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              All Timeframes
            </button>
            <button
              type="button"
              onClick={() => setTimeframeFilter('1m')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                timeframeFilter === '1m'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              1 min
            </button>
            <button
              type="button"
              onClick={() => setTimeframeFilter('5m')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                timeframeFilter === '5m'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              5 min
            </button>
            <button
              type="button"
              onClick={() => setTimeframeFilter('15m')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                timeframeFilter === '15m'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              15 min
            </button>
            <button
              type="button"
              onClick={() => setTimeframeFilter('30m')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                timeframeFilter === '30m'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              30 min
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-xs text-zinc-500 font-medium">Re-calculating ledger...</span>
          </div>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-800/80 rounded-2xl">
            <Layers className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-500 font-medium">No closed trades recorded in this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-3">Close Time</th>
                  <th className="pb-3">Pair / Asset</th>
                  <th className="pb-3 text-center">Direction</th>
                  <th className="pb-3 text-center">Duration</th>
                  <th className="pb-3 text-right">Entry Price</th>
                  <th className="pb-3 text-right">Exit Price</th>
                  <th className="pb-3 text-right">Stake (USD)</th>
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
                      <td className="py-3.5 font-bold text-zinc-200">{getDisplaySymbolName(t.pair).split(' (')[0]}</td>
                      <td className="py-3.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase ${
                            t.direction === 'LONG'
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                              : 'bg-red-950/20 border-red-900/50 text-red-400'
                          }`}
                        >
                          {t.direction === 'LONG' ? 'RISE (CALL)' : 'FALL (PUT)'}
                        </span>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
                          {t.duration ? `${t.duration}${t.duration_unit || 'm'}` : '15m'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">{t.entry_price.toFixed(4)}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">{t.exit_price ? t.exit_price.toFixed(4) : 'N/A'}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">
                        {`$${t.amount.toFixed(1)}`}
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold">
                        <div
                          className={`flex items-center justify-end gap-0.5 ${
                            isWin ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isWin ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                           <span>
                             {isWin ? '+' : ''}
                             {(t.pnl || 0).toFixed(2)} USD
                           </span>
                        </div>
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
