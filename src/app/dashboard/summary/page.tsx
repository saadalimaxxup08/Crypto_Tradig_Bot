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
}

export default function SummaryPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [hourlyFilter, setHourlyFilter] = useState<'none' | '1h' | '3h' | '6h' | '12h'>('none');

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
        
        const filtered = allTrades.filter((t) => {
          if (t.status !== 'CLOSED' || !t.closed_at) return false;
          const closedTime = new Date(t.closed_at);
          
          if (hourlyFilter !== 'none') {
            const hours = hourlyFilter === '1h' ? 1 : hourlyFilter === '3h' ? 3 : hourlyFilter === '6h' ? 6 : 12;
            const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
            return closedTime >= cutoff;
          } else {
            // Convert input dates to comparable ISO boundaries (Local start/end of days)
            const startBoundary = new Date(startDate);
            startBoundary.setHours(0, 0, 0, 0);

            const endBoundary = new Date(endDate);
            endBoundary.setHours(23, 59, 59, 999);
            return closedTime >= startBoundary && closedTime <= endBoundary;
          }
        });

        // Sort ascending by close time
        filtered.sort((a, b) => new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime());
        setTrades(filtered);

        // Fetch active trades
        const active = allTrades.filter((t) => t.status === 'OPEN');
        setActiveTrades(active);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryTrades();
  }, [startDate, endDate, hourlyFilter]);

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
  const netPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  // PDF Generator Engine (using jsPDF)
  const generatePDF = (download: boolean = true) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text("CryptoAI VIP Trader Terminal", 14, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text("Performance Summary Report & Active Ledger", 14, 25);
    doc.text(`Period: ${new Date(startDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })} to ${new Date(endDate).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' })}`, 14, 30);
    doc.line(14, 33, 196, 33);

    // Summary Metrics Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("SUMMARY PERFORMANCE METRICS", 14, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Closed Trades: ${totalTrades}`, 14, 46);
    doc.text(`Win Rate %: ${winRate.toFixed(1)}% (Wins: ${wins} / Losses: ${losses})`, 14, 51);
    doc.text(`Net Cumulative P&L: ${netPnl.toFixed(4)} USDT`, 14, 56);
    doc.text(`Avg Trade P&L: ${(totalTrades > 0 ? netPnl / totalTrades : 0).toFixed(4)} USDT`, 14, 61);

    doc.line(14, 66, 196, 66);

    let currentY = 73;

    // Active positions table
    if (activeTrades.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`ACTIVE RUNNING POSITIONS (${activeTrades.length})`, 14, currentY);
      currentY += 5;

      doc.setFontSize(8);
      doc.text("Open Time", 14, currentY);
      doc.text("Pair", 52, currentY);
      doc.text("Dir", 80, currentY);
      doc.text("Entry Price", 93, currentY);
      doc.text("Live Price", 120, currentY);
      doc.text("Duration", 148, currentY);
      doc.text("Margin", 170, currentY);
      doc.text("Floating P&L", 188, currentY);
      currentY += 3;
      doc.line(14, currentY - 1, 196, currentY - 1);

      doc.setFont('helvetica', 'normal');
      activeTrades.forEach((t) => {
        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
        }
        const curPrice = livePrices[t.pair] || t.entry_price;
        const pnl = (curPrice - t.entry_price) * t.amount * (t.direction === 'LONG' ? 1 : -1);
        const entryTime = new Date(t.timestamp).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) + ' ' + new Date(t.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
        
        const timeInMarket = new Date(t.timestamp);
        const durationMs = Date.now() - timeInMarket.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

        doc.text(entryTime, 14, currentY);
        doc.text(t.pair, 52, currentY);
        doc.text(t.direction, 80, currentY);
        doc.text(t.entry_price.toFixed(4), 93, currentY);
        doc.text(curPrice.toFixed(4), 120, currentY);
        doc.text(durationStr, 148, currentY);
        doc.text(`${(t.margin || 1.0).toFixed(1)} USDT`, 170, currentY);
        doc.text(`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`, 188, currentY);
        currentY += 5.5;
      });

      currentY += 2;
      doc.line(14, currentY - 1, 196, currentY - 1);
      currentY += 4;
    }

    // Closed Trades table
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`CLOSED TRADES LEDGER (${trades.length})`, 14, currentY);
    currentY += 5;

    doc.setFontSize(8);
    doc.text("Close Time", 14, currentY);
    doc.text("Pair", 52, currentY);
    doc.text("Dir", 80, currentY);
    doc.text("Entry Price", 93, currentY);
    doc.text("Exit Price", 120, currentY);
    doc.text("Margin", 148, currentY);
    doc.text("Leverage", 170, currentY);
    doc.text("Realized P&L", 188, currentY);
    currentY += 3;
    doc.line(14, currentY - 1, 196, currentY - 1);

    doc.setFont('helvetica', 'normal');
    trades.forEach((t) => {
      if (currentY > 275) {
        doc.addPage();
        currentY = 20;
      }
      const closeTime = new Date(t.closed_at).toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) + ' ' + new Date(t.closed_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
      const sign = (t.pnl || 0) >= 0 ? '+' : '';

      doc.text(closeTime, 14, currentY);
      doc.text(t.pair, 52, currentY);
      doc.text(t.direction, 80, currentY);
      doc.text(t.entry_price.toFixed(4), 93, currentY);
      doc.text(t.exit_price ? t.exit_price.toFixed(4) : 'N/A', 120, currentY);
      doc.text(`${(t.margin || 10.0).toFixed(1)} USDT`, 148, currentY);
      doc.text(`${t.leverage || 20}x`, 170, currentY);
      doc.text(`${sign}${(t.pnl || 0).toFixed(2)} USDT`, 188, currentY);
      currentY += 5.5;
    });

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

        {/* Net Profit */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Net P&L</span>
          <h3 className={`text-2xl font-extrabold mt-2 ${netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netPnl >= 0 ? '+' : ''}
            {netPnl.toFixed(4)}
            <span className="text-xs font-medium ml-1">USDT</span>
          </h3>
          <p className="text-[9px] text-zinc-500 mt-1">Realized value after fees</p>
        </div>

        {/* Avg P&L per Trade */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden print-card">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Avg Trade P&L</span>
          <h3 className="text-2xl font-extrabold text-zinc-200 mt-2">
            {totalTrades > 0 ? (netPnl / totalTrades).toFixed(4) : '0.0000'}
            <span className="text-xs font-medium ml-1">USDT</span>
          </h3>
          <p className="text-[9px] text-zinc-500 mt-1">Mean return per operation</p>
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
