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
}

export default function SummaryPage() {
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
  const [selectedStrategy, setSelectedStrategy] = useState<'RSI_MACD' | 'BOLLINGER_RSI' | 'BOLLINGER_RSI_OPT' | 'DOUBLE_EMA' | 'DOUBLE_EMA_OPT' | 'DOUBLE_EMA_5M' | 'DOUBLE_EMA_15M' | 'SUPERTREND_EMA' | 'SUPERTREND_EMA_OPT' | 'STOCH_RSI_MACD' | 'ATR_BREAKOUT' | 'SWING_STRUCTURE' | 'MACD_DIVERGENCE' | 'KDJ_REVERSION' | 'KDJ_REVERSION_OPT' | 'FIBONACCI_PULLBACK' | 'ICHIMOKU_CLOUDBREAK' | 'VWAP_REVERSION' | 'VWAP_REVERSION_OPT' | 'COMBINATION_STRATEGIES'>('RSI_MACD');
  const [activeStrategySetting, setActiveStrategySetting] = useState('RSI_MACD');
  const [allRawTrades, setAllRawTrades] = useState<Trade[]>([]);

  // Default date ranges setup
  useEffect(() => {
    const today = new Date();
    // Default start date is 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Format to yyyy-mm-dd
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    setStartDate(formatDateStr(sevenDaysAgo));
    setEndDate(formatDateStr(today));
  }, []);

  const applyFilters = (allTrades: Trade[]) => {
    // Filter only live trades (is_paper is false)
    const strategyTrades = allTrades.filter((t) => !t.is_paper);

    // 2. Filter by date/hours cutoff
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

  const fetchSummaryTrades = async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const res = await fetch('/api/trades');
      const data = await res.json();
      if (res.ok && data.success) {
        const allTrades: Trade[] = data.trades || [];
        setLivePrices(data.livePrices || {});
        setAllRawTrades(allTrades);
        applyFilters(allTrades);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (allRawTrades.length > 0) {
      applyFilters(allRawTrades);
    }
  }, [startDate, endDate, hourlyFilter]);

  useEffect(() => {
    fetchSummaryTrades();
  }, [startDate, endDate, hourlyFilter]);

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
    doc.text("CryptoAI VIP Trader Terminal", 14, 13);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 165);
    doc.text("Performance Summary Report & Verified Ledger (Jeddah Time)", 14, 19);
    
    const dateRangeStr = `Period: ${new Date(startDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })} to ${new Date(endDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })}`;
    doc.text(dateRangeStr, 196, 19, { align: 'right' });

    // 2. Metrics Bounding Box Cards Grid
    const cardY = 40;
    const cardH = 18;
    
    // Default border/fills styling for cards
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
    doc.setTextColor(147, 51, 234); // Purple win rate
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
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`+${netPnl.toFixed(4)}`, 107, cardY + 12);
    } else {
      doc.setTextColor(239, 68, 68); // Red
      doc.text(`${netPnl.toFixed(4)}`, 107, cardY + 12);
    }
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("USDT (net values)", 107, cardY + 16);

    // Card 4: Avg Trade Return
    doc.rect(152, cardY, 44, cardH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 125);
    doc.text("AVERAGE RETURN", 155, cardY + 5);
    doc.setFontSize(11);
    const avgReturn = totalTrades > 0 ? netPnl / totalTrades : 0;
    if (avgReturn >= 0) {
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`+${avgReturn.toFixed(4)}`, 155, cardY + 12);
    } else {
      doc.setTextColor(239, 68, 68); // Red
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

      // Table Header Row background fill
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
        
        // Direction highlight
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

        // Floating P&L highlight
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

        // Draw light divider line
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

    // Table Header Row background fill
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

      // Direction highlight
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

      // Realized P&L highlight
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

      // Row divider
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
        doc.text("TOTAL CUMULATIVE P&L", 17, currentY);
        
        if (netPnl >= 0) {
          doc.setTextColor(16, 185, 129);
          doc.text(`+${netPnl.toFixed(4)} USDT`, 175, currentY);
        } else {
          doc.setTextColor(239, 68, 68);
          doc.text(`${netPnl.toFixed(4)} USDT`, 175, currentY);
        }
        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(200, 200, 205);
        doc.line(14, currentY + 2, 196, currentY + 2);
        currentY += 8;
      }
    }

    if (download) {
      doc.save(`CryptoAI_Report_${startDate}_to_${endDate}.pdf`);
      return null;
    } else {
      return doc.output('blob');
    }
  };

  const handleDownloadPDF = () => {
    generatePDF(true);
  };

  // Compile and dispatch PDF to Telegram channel
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

      const file = new File([pdfBlob], `CryptoAI_Report_${startDate}_to_${endDate}.pdf`, {
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
      {/* Dynamic styles for Printing */}
      <style jsx global>{`
        @media print {
          /* Hide sidebar, header, inputs and buttons during print */
          aside, header, .no-print, button, select, input {
            display: none !important;
          }
          /* Expand report to full width */
          body, main, .max-w-5xl {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          /* Print styling overrides */
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
          <h2 className="text-2xl font-extrabold tracking-tight">Summary Report Center</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Analyze, print, download, or share trade statistics across customizable date ranges.
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

      {/* Date Pickers & Quick Filters (Hidden in print) */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6 no-print">
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
            {/* Date-based Filters */}
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

            {/* Hour-based Filters */}
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

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print-header text-black">
        <h1 className="text-xl font-bold uppercase tracking-wider">CryptoAI VIP Trader Terminal</h1>
        <p className="text-xs text-gray-600 mt-1">
          Trading Performance Summary: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
        </p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Trades */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Trades</span>
          <h3 className="text-2xl font-extrabold text-zinc-200 mt-2">{totalTrades}</h3>
          <p className="text-[9px] text-zinc-500 mt-1">Closed positions in range</p>
        </div>

        {/* Win Rate */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-purple-400">Win Rate %</span>
          <h3 className="text-2xl font-extrabold text-purple-400 mt-2">{winRate.toFixed(1)}%</h3>
          <p className="text-[9px] text-zinc-500 mt-1">Wins: {wins} | Losses: {losses}</p>
        </div>

        {/* Net Profit / Total P&L */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Total P&L</span>
          <h3 className={`text-2xl font-extrabold mt-2 ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netPnl >= 0 ? '+' : ''}
            {netPnl.toFixed(4)}
            <span className="text-xs font-medium ml-1">USDT</span>
          </h3>
          <p className="text-[9px] text-zinc-500 mt-1">Realized value after fees</p>
        </div>

        {/* Daily P&L */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          {/* Calculate daily P&L */}
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
                  <th className="pb-3">Pair</th>
                  <th className="pb-3 text-center">Direction</th>
                  <th className="pb-3 text-right">Entry Price</th>
                  <th className="pb-3 text-right">Live Price</th>
                  <th className="pb-3 text-center">Time In Market</th>
                  <th className="pb-3 text-right">Margin / Size</th>
                  <th className="pb-3 text-right">Floating P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-xs">
                {activeTrades.map((t) => {
                  const currentPrice = livePrices[t.pair] || t.entry_price;
                  const floatingPnl = (currentPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
                  const isProfit = floatingPnl >= 0;
                  
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
                      <td className="py-3.5 text-right font-mono text-zinc-400">{t.entry_price.toFixed(4)}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-200 font-bold">{currentPrice.toFixed(4)}</td>
                      <td className="py-3.5 text-center text-zinc-300 font-medium">{durationStr}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">
                        {t.margin ? `${t.margin.toFixed(1)} USDT` : '1.0 USDT'} <span className="text-[10px] text-zinc-600">({t.leverage || 20}x)</span>
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
                            {floatingPnl.toFixed(4)} USDT
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

      {/* Detailed Ledger List */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4 print-card">
        <h3 className="text-md font-bold text-zinc-200 pb-2 border-b border-zinc-800/50">Trades Execution Ledger</h3>

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
                      <td className="py-3.5 text-right font-mono text-zinc-400">{t.entry_price.toFixed(4)}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">{t.exit_price ? t.exit_price.toFixed(4) : 'N/A'}</td>
                      <td className="py-3.5 text-right font-mono text-zinc-400">
                        {t.margin ? `${t.margin.toFixed(1)} USDT` : 'N/A'} <span className="text-[10px] text-zinc-600">({t.leverage}x)</span>
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
                             {(t.pnl || 0).toFixed(4)} USDT
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
