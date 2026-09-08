'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, Radio, TrendingUp, TrendingDown, RefreshCw, Zap, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

interface DerivPairState {
  symbol: string;
  name: string;
  category: string;
  currentPrice: number;
  priceDirection: 'up' | 'down' | 'flat';
  adx: number;
  stochK: number;
  stochD: number;
  h1Trend: 'UP' | 'DOWN' | 'NEUTRAL';
  m15Trend: 'UP' | 'DOWN' | 'NEUTRAL';
  signal: 'CALL' | 'PUT' | 'WAITING' | 'NEUTRAL';
  reason?: string;
  updatedAt?: string;
}

const CATEGORY_MAP: { [key: string]: string } = {
  stpRNG: 'Derived', stpRNG2: 'Derived', stpRNG3: 'Derived', stpRNG4: 'Derived', stpRNG5: 'Derived',
  R_10: 'Derived', R_25: 'Derived', R_50: 'Derived', R_75: 'Derived', R_100: 'Derived',
  '1HZ10V': 'Derived', '1HZ15V': 'Derived', '1HZ25V': 'Derived', '1HZ30V': 'Derived', '1HZ50V': 'Derived', '1HZ75V': 'Derived', '1HZ90V': 'Derived', '1HZ100V': 'Derived',
  JD10: 'Derived', JD25: 'Derived', JD50: 'Derived', JD75: 'Derived', JD100: 'Derived', RDBULL: 'Derived', RDBEAR: 'Derived',
  frxEURUSD: 'Forex', frxGBPUSD: 'Forex', frxUSDJPY: 'Forex', frxAUDUSD: 'Forex', frxUSDCAD: 'Forex', frxUSDCHF: 'Forex',
  frxAUDJPY: 'Forex', frxEURJPY: 'Forex', frxGBPJPY: 'Forex', frxNZDJPY: 'Forex', frxNZDUSD: 'Forex', frxAUDCAD: 'Forex',
  frxEURCHF: 'Forex', frxEURGBP: 'Forex', frxGBPCHF: 'Forex', frxEURCAD: 'Forex', frxAUDCHF: 'Forex', frxAUDNZD: 'Forex',
  frxEURAUD: 'Forex', frxEURNZD: 'Forex', frxGBPAUD: 'Forex', frxGBPCAD: 'Forex', frxGBPNZD: 'Forex', frxUSDMXN: 'Forex', frxUSDPLN: 'Forex',
  OTC_DJI: 'Stocks & Indices', OTC_NDX: 'Stocks & Indices', OTC_SPC: 'Stocks & Indices', OTC_GDAXI: 'Stocks & Indices',
  OTC_FTSE: 'Stocks & Indices', OTC_FCHI: 'Stocks & Indices', OTC_N225: 'Stocks & Indices', OTC_HSI: 'Stocks & Indices',
  OTC_AEX: 'Stocks & Indices', OTC_AS51: 'Stocks & Indices', OTC_SSMI: 'Stocks & Indices', OTC_SX5E: 'Stocks & Indices',
  frxXAUUSD: 'Commodities', frxXAGUSD: 'Commodities', frxXPDUSD: 'Commodities', frxXPTUSD: 'Commodities',
  WLDUSD: 'Commodities', WLDEUR: 'Commodities', WLDAUD: 'Commodities', WLDGBP: 'Commodities', WLDXAU: 'Commodities'
};

const SYMBOL_NAMES: { [key: string]: string } = {
  stpRNG: 'Step Index 100', stpRNG2: 'Step Index 200', stpRNG3: 'Step Index 300', stpRNG4: 'Step Index 400', stpRNG5: 'Step Index 500',
  R_10: 'Volatility 10 Index', R_25: 'Volatility 25 Index', R_50: 'Volatility 50 Index', R_75: 'Volatility 75 Index', R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index', '1HZ75V': 'Volatility 75 (1s) Index', '1HZ100V': 'Volatility 100 (1s) Index',
  JD50: 'Jump 50 Index', JD100: 'Jump 100 Index',
  frxEURUSD: 'EUR/USD', frxGBPUSD: 'GBP/USD', frxUSDJPY: 'USD/JPY', frxAUDUSD: 'AUD/USD', frxUSDCAD: 'USD/CAD', frxUSDCHF: 'USD/CHF',
  frxAUDJPY: 'AUD/JPY', frxEURJPY: 'EUR/JPY', frxGBPJPY: 'GBP/JPY', frxNZDJPY: 'NZD/JPY', frxNZDUSD: 'NZD/USD', frxAUDCAD: 'AUD/CAD',
  frxEURCHF: 'EUR/CHF', frxEURGBP: 'EUR/GBP', frxGBPCHF: 'GBP/CHF', frxEURCAD: 'EUR/CAD',
  OTC_DJI: 'US 30 (Dow Jones)', OTC_NDX: 'US Tech 100 (Nasdaq)', OTC_SPC: 'US 500 (S&P 500)', OTC_GDAXI: 'Germany 40 (DAX)',
  frxXAUUSD: 'Gold / USD', frxXAGUSD: 'Silver / USD'
};

export default function DerivScannerPage() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [pairsData, setPairsData] = useState<{ [symbol: string]: DerivPairState }>({});
  const [nearEntries, setNearEntries] = useState<any[]>([]);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [lastScanAt, setLastScanAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // 1. Fetch settings, selected pairs, and watchlist diagnostic data from API
  const loadDerivScannerData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/deriv/settings');
      const data = await res.json();

      if (data.success) {
        const pairs: string[] = data.derivSelectedPairs || ['stpRNG5', 'stpRNG4', 'stpRNG3', 'stpRNG2', 'stpRNG', 'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY'];
        setSelectedPairs(pairs);
        setNearEntries(data.derivNearEntryPairs || []);
        setScanLogs(data.lastScanLogs || []);
        setLastScanAt(data.lastScanAt || '');

        // Initialize state for each pair
        const initialMap: { [symbol: string]: DerivPairState } = {};
        pairs.forEach((sym) => {
          const name = SYMBOL_NAMES[sym] || sym;
          const category = CATEGORY_MAP[sym] || 'Derived';
          
          // Check if there is watchlist diagnostic data
          const nearMatch = (data.derivNearEntryPairs || []).find((n: any) => n.symbol === sym);

          initialMap[sym] = {
            symbol: sym,
            name,
            category,
            currentPrice: 0,
            priceDirection: 'flat',
            adx: nearMatch ? nearMatch.adx || 0 : 0,
            stochK: nearMatch ? nearMatch.stochK || 0 : 0,
            stochD: nearMatch ? nearMatch.stochD || 0 : 0,
            h1Trend: nearMatch ? (nearMatch.direction === 'CALL' ? 'UP' : 'DOWN') : 'NEUTRAL',
            m15Trend: nearMatch ? (nearMatch.direction === 'CALL' ? 'UP' : 'DOWN') : 'NEUTRAL',
            signal: nearMatch ? (nearMatch.direction || 'WAITING') : 'NEUTRAL',
            reason: nearMatch ? nearMatch.reason : undefined,
            updatedAt: nearMatch ? nearMatch.updatedAt : undefined
          };
        });

        setPairsData(initialMap);
      }
    } catch (err) {
      console.error('Failed to load Deriv scanner data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Trigger manual scanner cycle
  const triggerManualScan = async () => {
    try {
      setIsScanning(true);
      const res = await fetch('/api/deriv/cron');
      const data = await res.json();
      if (data.logs) {
        setScanLogs(data.logs);
      }
      await loadDerivScannerData();
    } catch (e) {
      console.error('Manual scan error:', e);
    } finally {
      setIsScanning(false);
    }
  };

  // 3. Connect to Deriv Public WebSocket for live real-time price tick updates
  useEffect(() => {
    loadDerivScannerData();
  }, []);

  useEffect(() => {
    if (selectedPairs.length === 0) return;

    // Connect to Deriv WebSocket for live ticks
    const app_id = 1089;
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      // Subscribe to live ticks for first 15 active pairs
      selectedPairs.slice(0, 15).forEach((sym) => {
        ws.send(JSON.stringify({ ticks: sym }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.msg_type === 'tick' && msg.tick) {
          const sym = msg.tick.symbol;
          const newPrice = parseFloat(msg.tick.quote);

          setPairsData((prev) => {
            const pair = prev[sym];
            if (!pair) return prev;

            let priceDirection: 'up' | 'down' | 'flat' = 'flat';
            if (pair.currentPrice > 0) {
              if (newPrice > pair.currentPrice) priceDirection = 'up';
              else if (newPrice < pair.currentPrice) priceDirection = 'down';
            }

            return {
              ...prev,
              [sym]: {
                ...pair,
                currentPrice: newPrice,
                priceDirection
              }
            };
          });
        }
      } catch (e) {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedPairs]);

  // Filter pairs by active category tab
  const filteredSymbols = Object.keys(pairsData).filter((sym) => {
    if (selectedCategory === 'ALL') return true;
    return pairsData[sym]?.category === selectedCategory;
  });

  if (isLoading && Object.keys(pairsData).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Initializing Deriv MTF Live Scanner...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Header Bar */}
      <div className="bg-[#0b0b0e]/60 backdrop-blur-xl border border-zinc-800/80 p-6 lg:p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Multi-Timeframe Options Scanner</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Deriv Live Scanner Console
            </h2>
            <p className="text-xs text-zinc-400 max-w-xl">
              Real-time multi-timeframe trend analysis, ADX momentum checks, and Stochastic crossovers across Deriv Rise/Fall pairs.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Live WebSocket Badge */}
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              wsConnected ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400' : 'bg-amber-950/30 border-amber-800/60 text-amber-400'
            }`}>
              <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'animate-pulse' : ''}`} />
              <span>{wsConnected ? 'Deriv Stream Live' : 'Connecting...'}</span>
            </div>

            {/* Run Scan Button */}
            <button
              onClick={triggerManualScan}
              disabled={isScanning}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Deriv...' : 'Run Scan Cycle'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Near-Entry Watchlist Diagnostic Cards */}
      {nearEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Watchlist Diagnostics (Pairs Nearing Entry)</span>
            </h3>
            <span className="text-[10px] text-zinc-500 font-bold">{nearEntries.length} Pair(s) Monitored</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearEntries.map((item, idx) => (
              <div key={idx} className="bg-[#0e0e13]/80 border border-amber-900/40 hover:border-amber-500/50 p-4 rounded-2xl space-y-2 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-zinc-200">{SYMBOL_NAMES[item.symbol] || item.symbol}</span>
                  <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md border ${
                    item.direction === 'CALL' ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400' : 'bg-red-950/40 border-red-800/60 text-red-400'
                  }`}>
                    {item.direction === 'CALL' ? '↗️ RISE (CALL)' : '↘️ FALL (PUT)'}
                  </span>
                </div>
                <p className="text-xs text-amber-300/90 font-medium leading-relaxed">{item.reason}</p>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-900">
                  <span>ADX: <strong className="text-zinc-300">{item.adx ? item.adx.toFixed(1) : 'N/A'}</strong></span>
                  <span>Stoch %K: <strong className="text-zinc-300">{item.stochK ? item.stochK.toFixed(0) : 'N/A'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: 'ALL', label: 'All Pairs' },
          { id: 'Derived', label: '⚡ Derived (Synthetics)' },
          { id: 'Forex', label: '🌐 Forex' },
          { id: 'Stocks & Indices', label: '📈 Stocks & Indices' },
          { id: 'Commodities', label: '🥇 Commodities' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === tab.id
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700 shadow-md'
                : 'bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 border border-zinc-850'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Scanner Grid */}
      <div className="bg-[#0b0b0e]/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 overflow-hidden">
        {filteredSymbols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-800/80 rounded-2xl">
            <Activity className="w-10 h-10 text-zinc-600 mb-2 animate-pulse" />
            <p className="text-sm text-zinc-500 font-medium">No Deriv pairs selected in this category</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-4 pl-2">Deriv Symbol</th>
                  <th className="pb-4 text-center">Category</th>
                  <th className="pb-4 text-right">Live Tick Price</th>
                  <th className="pb-4 text-center">1H Trend</th>
                  <th className="pb-4 text-center">15M Trend</th>
                  <th className="pb-4 text-center">ADX Strength</th>
                  <th className="pb-4 text-center">Scanner Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-xs font-medium">
                {filteredSymbols.map((sym) => {
                  const p = pairsData[sym];
                  if (!p) return null;

                  return (
                    <tr key={sym} className="hover:bg-zinc-900/20 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-zinc-200">
                        <div className="flex flex-col">
                          <span className="text-sm text-white">{p.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{p.symbol}</span>
                        </div>
                      </td>

                      <td className="py-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400">
                          {p.category}
                        </span>
                      </td>

                      <td className="py-3.5 text-right font-mono font-bold text-sm">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.priceDirection === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                          {p.priceDirection === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                          <span className={
                            p.priceDirection === 'up' ? 'text-emerald-400' : p.priceDirection === 'down' ? 'text-red-400' : 'text-zinc-200'
                          }>
                            {p.currentPrice > 0 ? p.currentPrice.toFixed(p.currentPrice < 10 ? 4 : 2) : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          p.h1Trend === 'UP' ? 'text-emerald-400 bg-emerald-950/40' : p.h1Trend === 'DOWN' ? 'text-red-400 bg-red-950/40' : 'text-zinc-500'
                        }`}>
                          {p.h1Trend}
                        </span>
                      </td>

                      <td className="py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          p.m15Trend === 'UP' ? 'text-emerald-400 bg-emerald-950/40' : p.m15Trend === 'DOWN' ? 'text-red-400 bg-red-950/40' : 'text-zinc-500'
                        }`}>
                          {p.m15Trend}
                        </span>
                      </td>

                      <td className="py-3.5 text-center font-mono font-bold">
                        <span className={p.adx > 22 ? 'text-emerald-400' : 'text-zinc-500'}>
                          {p.adx > 0 ? p.adx.toFixed(1) : '—'}
                        </span>
                      </td>

                      <td className="py-3.5 text-center">
                        {p.signal === 'CALL' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-950/60 border border-emerald-700/60 text-emerald-400 animate-pulse">
                            ↗️ CALL (RISE)
                          </span>
                        ) : p.signal === 'PUT' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-red-950/60 border border-red-700/60 text-red-400 animate-pulse">
                            ↘️ PUT (FALL)
                          </span>
                        ) : p.signal === 'WAITING' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-950/40 border border-amber-800/40 text-amber-400">
                            ⏳ WATCHLIST
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-500">
                            ⏸️ NEUTRAL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Backend Scan Logs Terminal Accordion */}
      {scanLogs.length > 0 && (
        <div className="bg-[#08080b] border border-zinc-800/80 p-5 rounded-3xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400 border-b border-zinc-850 pb-2">
            <span className="flex items-center gap-2 text-emerald-400 font-mono">
              <Zap className="w-4 h-4" />
              <span>Backend Deriv Scan Log Output</span>
            </span>
            <span>{lastScanAt ? new Date(lastScanAt).toLocaleTimeString() : ''}</span>
          </div>
          <div className="font-mono text-[11px] text-zinc-400 space-y-1 max-h-40 overflow-y-auto pt-2">
            {scanLogs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
