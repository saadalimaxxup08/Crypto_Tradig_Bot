'use client';

import { useState, useEffect, useRef } from 'react';
import { calculateRSI, calculateMACD } from '@/lib/indicators';
import { Activity, Radio, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface PairScannerState {
  symbol: string;
  prices: number[];
  currentPrice: number;
  priceDirection: 'up' | 'down' | 'flat';
  rsi: number;
  macd: { macdLine: number; signalLine: number; histogram: number };
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
}

export default function ScannerPage() {
  const [pairsData, setPairsData] = useState<{ [symbol: string]: PairScannerState }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [timeframe, setTimeframe] = useState('1m');
  const socketRef = useRef<WebSocket | null>(null);

  // 1. Fetch initial historical candles from REST API
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/scanner/candles');
      const data = await res.json();

      if (data.success) {
        setTimeframe(data.timeframe || '1m');
        const initialStates: { [symbol: string]: PairScannerState } = {};

        Object.keys(data.candles).forEach((symbol) => {
          const prices = data.candles[symbol];
          if (prices.length > 0) {
            const currentPrice = prices[prices.length - 1];
            
            // Calculate RSI and MACD
            const rsiValues = calculateRSI(prices, 14);
            const { macdLine, signalLine, histogram } = calculateMACD(prices, 12, 26, 9);
            
            const currentRsi = rsiValues[rsiValues.length - 1] || 50;
            const currentMacdLine = macdLine[macdLine.length - 1] || 0;
            const currentSignalLine = signalLine[signalLine.length - 1] || 0;
            const currentHistogram = histogram[histogram.length - 1] || 0;

            const prevMacdLine = macdLine[macdLine.length - 2] || 0;
            const prevSignalLine = signalLine[signalLine.length - 2] || 0;

            let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
            if (currentRsi < 30 && prevMacdLine <= prevSignalLine && currentMacdLine > currentSignalLine) {
              signal = 'BUY';
            } else if (currentRsi > 70 && prevMacdLine >= prevSignalLine && currentMacdLine < currentSignalLine) {
              signal = 'SELL';
            }

            initialStates[symbol] = {
              symbol,
              prices,
              currentPrice,
              priceDirection: 'flat',
              rsi: currentRsi,
              macd: {
                macdLine: currentMacdLine,
                signalLine: currentSignalLine,
                histogram: currentHistogram
              },
              signal,
            };
          }
        });

        setPairsData(initialStates);
      }
    } catch (err) {
      console.error('Failed to load scanner candle history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Connect to Binance WebSocket for real-time ticker/kline updates
  useEffect(() => {
    loadInitialData();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (Object.keys(pairsData).length === 0) return;

    // Connect to Binance Futures WebSocket stream
    const symbols = Object.keys(pairsData);
    const streams = symbols.map((s) => `${s.toLowerCase()}@kline_${timeframe}`).join('/');
    const wsUrl = `wss://fstream.binance.com/stream?streams=${streams}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log('Binance WebSocket Connected for Live Scanner');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!message.data || message.data.e !== 'kline') return;

        const kline = message.data.k;
        const symbol = message.data.s; // e.g. BTCUSDT
        const closePrice = parseFloat(kline.c);
        const isClosed = kline.x; // true if candle closed

        setPairsData((prev) => {
          const pair = prev[symbol];
          if (!pair) return prev;

          // Determine direction
          let priceDirection: 'up' | 'down' | 'flat' = 'flat';
          if (closePrice > pair.currentPrice) priceDirection = 'up';
          else if (closePrice < pair.currentPrice) priceDirection = 'down';

          // Update prices list
          let updatedPrices = [...pair.prices];
          if (isClosed) {
            // Candle closed: push new price, remove oldest
            updatedPrices.push(closePrice);
            updatedPrices.shift();
          } else {
            // Live candle: update last price
            updatedPrices[updatedPrices.length - 1] = closePrice;
          }

          // Recalculate indicators
          const rsiValues = calculateRSI(updatedPrices, 14);
          const { macdLine, signalLine, histogram } = calculateMACD(updatedPrices, 12, 26, 9);

          const currentRsi = rsiValues[rsiValues.length - 1] || 50;
          const currentMacdLine = macdLine[macdLine.length - 1] || 0;
          const currentSignalLine = signalLine[signalLine.length - 1] || 0;
          const currentHistogram = histogram[histogram.length - 1] || 0;

          const prevMacdLine = macdLine[macdLine.length - 2] || 0;
          const prevSignalLine = signalLine[signalLine.length - 2] || 0;

          let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
          if (currentRsi < 30 && prevMacdLine <= prevSignalLine && currentMacdLine > currentSignalLine) {
            signal = 'BUY';
          } else if (currentRsi > 70 && prevMacdLine >= prevSignalLine && currentMacdLine < currentSignalLine) {
            signal = 'SELL';
          }

          return {
            ...prev,
            [symbol]: {
              ...pair,
              prices: updatedPrices,
              currentPrice: closePrice,
              priceDirection,
              rsi: currentRsi,
              macd: {
                macdLine: currentMacdLine,
                signalLine: currentSignalLine,
                histogram: currentHistogram
              },
              signal,
            },
          };
        });
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('Binance WebSocket Disconnected. Retrying in 5s...');
      setTimeout(() => {
        if (socketRef.current === ws) {
          // Reconnect
          setPairsData((prev) => ({ ...prev })); // triggers reconnect by dependency
        }
      }, 5000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      ws.close();
    };
  }, [isLoading, timeframe]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Initializing Live Scanner feed...</p>
      </div>
    );
  }

  const pairsList = Object.values(pairsData);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Connection Header */}
      <div className="flex justify-between items-center bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Live Strategy Scanner</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time RSI(14) & MACD(12, 26, 9) analyzer via Binance WebSocket ({timeframe} chart).
          </p>
        </div>

        {/* WebSocket Connection Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadInitialData}
            className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors mr-2"
            title="Refresh History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <div
            className={`flex items-center gap-2 border rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-inner ${
              wsConnected
                ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                : 'bg-red-950/20 border-red-900/50 text-red-400'
            }`}
          >
            <Radio className={`w-4 h-4 ${wsConnected ? 'animate-pulse' : ''}`} />
            <span>{wsConnected ? 'WEBSOCKET ACTIVE' : 'CONNECTING...'}</span>
          </div>
        </div>
      </div>

      {/* Grid of Tickers */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <th className="pb-4">Asset</th>
                <th className="pb-4 text-right">Live Price</th>
                <th className="pb-4 text-center">RSI (14)</th>
                <th className="pb-4 text-center">MACD Histogram</th>
                <th className="pb-4 text-center">Signal Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-sm">
              {pairsList.map((pair) => {
                const flashClass =
                  pair.priceDirection === 'up'
                    ? 'text-emerald-400 bg-emerald-950/15'
                    : pair.priceDirection === 'down'
                    ? 'text-red-400 bg-red-950/15'
                    : 'text-zinc-200';

                return (
                  <tr key={pair.symbol} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="py-4">
                      <span className="font-extrabold text-zinc-100">{pair.symbol}</span>
                    </td>
                    <td className="py-4 text-right font-mono font-bold">
                      <span className={`px-2.5 py-1 rounded-lg transition-all duration-300 ${flashClass}`}>
                        {pair.currentPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`font-mono font-extrabold ${
                            pair.rsi < 30
                              ? 'text-emerald-400'
                              : pair.rsi > 70
                              ? 'text-red-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {pair.rsi.toFixed(2)}
                        </span>
                        {/* Custom RSI range indicator bar */}
                        <div className="w-20 h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pair.rsi < 30
                                ? 'bg-emerald-500'
                                : pair.rsi > 70
                                ? 'bg-red-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${pair.rsi}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            pair.macd.histogram >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {pair.macd.histogram >= 0 ? '+' : ''}
                          {pair.macd.histogram.toFixed(4)}
                        </span>
                        {pair.macd.histogram >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-extrabold rounded-xl border ${
                          pair.signal === 'BUY'
                            ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400 shadow-md shadow-emerald-500/5 animate-pulse'
                            : pair.signal === 'SELL'
                            ? 'bg-red-950/30 border-red-900/50 text-red-400 shadow-md shadow-red-500/5 animate-pulse'
                            : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {pair.signal === 'BUY'
                          ? 'BUY / LONG'
                          : pair.signal === 'SELL'
                          ? 'SELL / SHORT'
                          : 'NEUTRAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
