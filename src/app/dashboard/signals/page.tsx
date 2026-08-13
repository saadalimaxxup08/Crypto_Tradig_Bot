'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, RefreshCw } from 'lucide-react';

interface Signal {
  id: string;
  timestamp: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  rsi: number;
  macd_line: number;
  signal_line: number;
  price: number;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSignals = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/signals');
      const data = await res.json();
      if (data.success) {
        setSignals(data.signals || []);
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
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading signals ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Signals History</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Archived logs of indicator triggers detected by the system.
          </p>
        </div>

        <button
          onClick={fetchSignals}
          disabled={isLoading}
          className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors"
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
            <p className="text-sm text-zinc-500 font-medium">No signals recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-4">Timestamp</th>
                  <th className="pb-4">Pair</th>
                  <th className="pb-4 text-center">Direction</th>
                  <th className="pb-4 text-right">Trigger Price</th>
                  <th className="pb-4 text-center">RSI</th>
                  <th className="pb-4 text-center">MACD / Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-sm">
                {signals.map((sig) => (
                  <tr key={sig.id} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="py-4 text-zinc-400 font-medium">
                      {new Date(sig.timestamp).toLocaleString()}
                    </td>
                    <td className="py-4 font-bold text-zinc-200">{sig.pair}</td>
                    <td className="py-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-md border ${
                          sig.direction === 'LONG'
                            ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                            : 'bg-red-950/20 border-red-900/50 text-red-400'
                        }`}
                      >
                        {sig.direction}
                      </span>
                    </td>
                    <td className="py-4 text-right font-mono font-bold text-zinc-300">
                      {sig.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-4 text-center">
                      <span className="font-mono text-zinc-300 font-semibold">{sig.rsi.toFixed(2)}</span>
                    </td>
                    <td className="py-4 text-center font-mono text-xs text-zinc-500 space-x-1.5">
                      <span>{sig.macd_line.toFixed(4)}</span>
                      <span>/</span>
                      <span>{sig.signal_line.toFixed(4)}</span>
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
