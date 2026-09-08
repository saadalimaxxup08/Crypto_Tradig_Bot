'use client';

import { useState, useEffect } from 'react';
import { Shield, RefreshCw, Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface DerivSignal {
  id: string;
  symbol: string;
  direction: 'CALL' | 'PUT' | 'WAITING';
  reason: string;
  adx: number;
  stochK: number;
  stochD: number;
  updatedAt: string;
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

export default function DerivSignalsPage() {
  const [signals, setSignals] = useState<DerivSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSignals = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/deriv/settings');
      const data = await res.json();
      if (data.success) {
        setSignals(data.derivNearEntryPairs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  if (isLoading && signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading Deriv signals ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Deriv Signals & Diagnostics</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Live watchlist diagnostics and indicator triggers detected across Deriv pairs.
          </p>
        </div>

        <button
          onClick={fetchSignals}
          disabled={isLoading}
          className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Refresh Signals"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Signals Table */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 overflow-hidden">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800/80 rounded-2xl">
            <Shield className="w-10 h-10 text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500 font-medium">No Deriv watchlist signals recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-4 pl-2">Last Scanned</th>
                  <th className="pb-4">Deriv Pair</th>
                  <th className="pb-4 text-center">Direction</th>
                  <th className="pb-4 text-center">ADX Strength</th>
                  <th className="pb-4 text-center">Stoch %K</th>
                  <th className="pb-4 text-left">Diagnostic Setup Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-sm">
                {signals.map((sig, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="py-4 pl-2 text-zinc-400 font-medium text-xs">
                      {sig.updatedAt ? new Date(sig.updatedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Riyadh' }) : 'Live'}
                    </td>
                    <td className="py-4 font-bold text-zinc-200">
                      <div className="flex flex-col">
                        <span className="text-white text-sm">{SYMBOL_NAMES[sig.symbol] || sig.symbol}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{sig.symbol}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md border ${
                          sig.direction === 'CALL'
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                            : 'bg-red-950/40 border-red-800/60 text-red-400'
                        }`}
                      >
                        {sig.direction === 'CALL' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{sig.direction === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}</span>
                      </span>
                    </td>
                    <td className="py-4 text-center font-mono text-xs font-bold text-emerald-400">
                      {sig.adx ? sig.adx.toFixed(1) : '—'}
                    </td>
                    <td className="py-4 text-center font-mono text-xs font-bold text-zinc-300">
                      {sig.stochK ? sig.stochK.toFixed(0) : '—'}
                    </td>
                    <td className="py-4 text-left text-xs text-amber-300/90 font-medium">
                      {sig.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
