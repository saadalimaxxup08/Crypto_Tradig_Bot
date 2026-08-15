'use client';

import { useState, useEffect } from 'react';
import { History, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
}

export default function TradesHistoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/trades');
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  if (isLoading && trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading trade logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Trades Ledger</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Comprehensive history of all positions filled on Binance Futures.
          </p>
        </div>

        <button
          onClick={fetchTrades}
          disabled={isLoading}
          className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Refresh Trades"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Trades Table */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 overflow-hidden">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800/80 rounded-2xl">
            <History className="w-10 h-10 text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500 font-medium">No trades executed yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-4">Open Time</th>
                  <th className="pb-4">Pair</th>
                  <th className="pb-4 text-center">Direction</th>
                  <th className="pb-4 text-right">Entry Price</th>
                  <th className="pb-4 text-right">Exit Price</th>
                  <th className="pb-4 text-right">SL / TP</th>
                  <th className="pb-4 text-right">Leverage</th>
                  <th className="pb-4 text-right">Margin / Size</th>
                  <th className="pb-4 text-right">P&L (USDT)</th>
                  <th className="pb-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-sm">
                {trades.map((trade) => {
                  const pnl = trade.pnl || 0;
                  const isWin = pnl >= 0;
                  return (
                    <tr key={trade.id} className="hover:bg-zinc-900/10 transition-colors">
                      <td className="py-4 text-zinc-400 font-medium text-xs">
                        {new Date(trade.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}
                      </td>
                      <td className="py-4 font-bold text-zinc-200">{trade.pair}</td>
                      <td className="py-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${
                            trade.direction === 'LONG'
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                              : 'bg-red-950/20 border-red-900/50 text-red-400'
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-4 text-right font-mono font-medium text-zinc-300">
                        {trade.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="py-4 text-right font-mono font-medium text-zinc-300">
                        {trade.exit_price
                          ? trade.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                          : '-'}
                      </td>
                      <td className="py-4 text-right text-xs space-y-0.5">
                        <div className="font-mono text-red-400/70">SL: {trade.sl_price.toFixed(4)}</div>
                        <div className="font-mono text-emerald-400/70">TP: {trade.tp_price.toFixed(4)}</div>
                      </td>
                      <td className="py-4 text-right font-mono font-bold text-emerald-400">
                        {trade.leverage || 20}x
                      </td>
                      <td className="py-4 text-right font-mono text-zinc-300">
                        <div className="text-zinc-200 font-bold">{(trade.entry_price * trade.amount).toFixed(2)} USDT</div>
                        <div className="text-[10px] text-zinc-500 font-medium">Margin: {parseFloat(String(trade.margin || 10)).toFixed(1)} USDT</div>
                      </td>
                      <td className="py-4 text-right">
                        {trade.status === 'CLOSED' ? (
                          <div
                            className={`font-mono font-bold flex items-center justify-end gap-0.5 ${
                              isWin ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isWin ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            <span>
                              {isWin ? '+' : ''}
                              {pnl.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 font-medium font-mono">-</span>
                        )}
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                            trade.status === 'OPEN'
                              ? 'bg-amber-950/30 text-amber-400 border border-amber-900/50 animate-pulse'
                              : 'bg-zinc-900/60 text-zinc-500 border border-zinc-800'
                          }`}
                        >
                          {trade.status}
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
