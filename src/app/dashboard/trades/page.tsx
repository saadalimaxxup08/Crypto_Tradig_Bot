'use client';

import { useState, useEffect } from 'react';
import { History, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface DerivTrade {
  id: string;
  contract_id: number;
  symbol: string;
  contract_type: 'CALL' | 'PUT';
  duration: number;
  duration_unit: string;
  stake: number;
  payout: number;
  status: 'OPEN' | 'WON' | 'LOST';
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  is_paper: boolean;
  created_at: string;
  closed_at: string | null;
}

const SYMBOL_NAMES: { [key: string]: string } = {
  stpRNG: 'Step Index 100', stpRNG2: 'Step Index 200', stpRNG3: 'Step Index 300', stpRNG4: 'Step Index 400', stpRNG5: 'Step Index 500',
  R_10: 'Volatility 10 Index', R_25: 'Volatility 25 Index', R_50: 'Volatility 50 Index', R_75: 'Volatility 75 Index', R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index', '1HZ75V': 'Volatility 75 (1s) Index', '1HZ100V': 'Volatility 100 (1s) Index',
  JD50: 'Jump 50 Index', JD100: 'Jump 100 Index',
  frxEURUSD: 'EUR/USD', frxGBPUSD: 'GBP/USD', frxUSDJPY: 'USD/JPY', frxAUDUSD: 'AUD/USD', frxUSDCAD: 'USD/CAD', frxUSDCHF: 'USD/CHF',
  frxAUDJPY: 'AUD/JPY', frxEURJPY: 'EUR/JPY', frxGBPJPY: 'GBP/JPY', frxNZDJPY: 'NZD/JPY', frxNZDUSD: 'NZD/USD', frxAUDCAD: 'AUD/CAD',
  frxEURCHF: 'EUR/CHF', frxEURGBP: 'EUR/GBP', frxGBPCHF: 'GBP/CHF', frxEURCAD: 'EUR/CAD'
};

export default function DerivTradesHistoryPage() {
  const [trades, setTrades] = useState<DerivTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/deriv/trades');
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades || []);
      }
    } catch (err) {
      console.error('Error fetching Deriv trades:', err);
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
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading Deriv trades ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Deriv Trades Ledger</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Comprehensive history of all Deriv Rise/Fall options filled by the bot.
          </p>
        </div>

        <button
          onClick={fetchTrades}
          disabled={isLoading}
          className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
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
            <p className="text-sm text-zinc-500 font-medium">No Deriv contracts executed yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-4 pl-2">Open Time</th>
                  <th className="pb-4">Contract ID</th>
                  <th className="pb-4">Deriv Symbol</th>
                  <th className="pb-4 text-center">Direction</th>
                  <th className="pb-4 text-center">Expiry</th>
                  <th className="pb-4 text-right">Stake ($)</th>
                  <th className="pb-4 text-right">Entry Spot</th>
                  <th className="pb-4 text-right">Exit Spot</th>
                  <th className="pb-4 text-right">P&L ($)</th>
                  <th className="pb-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-sm">
                {trades.map((t) => {
                  const pnl = parseFloat(String(t.pnl || 0));
                  const isWon = t.status === 'WON';
                  const isLost = t.status === 'LOST';
                  const isOpen = t.status === 'OPEN';

                  return (
                    <tr key={t.id} className="hover:bg-zinc-900/20 transition-colors">
                      <td className="py-4 pl-2 text-zinc-400 font-medium text-xs">
                        {new Date(t.created_at).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}
                      </td>

                      <td className="py-4 font-mono text-xs text-zinc-500">
                        {t.contract_id}
                      </td>

                      <td className="py-4 font-bold text-zinc-200">
                        <div className="flex flex-col">
                          <span className="text-white text-sm">{SYMBOL_NAMES[t.symbol] || t.symbol}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{t.symbol}</span>
                        </div>
                      </td>

                      <td className="py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md border ${
                          t.contract_type === 'CALL' ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400' : 'bg-red-950/40 border-red-800/60 text-red-400'
                        }`}>
                          {t.contract_type === 'CALL' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{t.contract_type === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}</span>
                        </span>
                      </td>

                      <td className="py-4 text-center font-mono text-xs text-zinc-400">
                        {t.duration}{t.duration_unit}
                      </td>

                      <td className="py-4 text-right font-mono text-xs font-semibold text-zinc-300">
                        ${t.stake ? t.stake.toFixed(2) : '1.00'}
                      </td>

                      <td className="py-4 text-right font-mono text-xs text-zinc-400">
                        {t.entry_price ? t.entry_price.toString() : '—'}
                      </td>

                      <td className="py-4 text-right font-mono text-xs text-zinc-400">
                        {t.exit_price ? t.exit_price.toString() : '—'}
                      </td>

                      <td className="py-4 text-right font-mono text-xs font-black">
                        {isOpen ? (
                          <span className="text-zinc-500">—</span>
                        ) : (
                          <span className={pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-zinc-400'}>
                            {pnl > 0 ? `+$${pnl.toFixed(2)}` : `$${pnl.toFixed(2)}`}
                          </span>
                        )}
                      </td>

                      <td className="py-4 text-center">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border ${
                          isWon
                            ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                            : isLost
                            ? 'bg-red-950/60 border-red-700/60 text-red-400'
                            : 'bg-amber-950/40 border-amber-800/40 text-amber-400 animate-pulse'
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
  );
}
