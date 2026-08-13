'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, HelpCircle, Eye, EyeOff } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SettingsPage() {
  const [botEnabled, setBotEnabled] = useState(false);
  const [tpPercent, setTpPercent] = useState('2.0');
  const [slPercent, setSlPercent] = useState('1.0');
  const [riskAmount, setRiskAmount] = useState('10.0');
  const [pairsText, setPairsText] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [binanceApiKey, setBinanceApiKey] = useState('');
  const [binanceSecretKey, setBinanceSecretKey] = useState('');

  const [showTelegram, setShowTelegram] = useState(false);
  const [showBinanceKey, setShowBinanceKey] = useState(false);
  const [showBinanceSecret, setShowBinanceSecret] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setBotEnabled(data.bot_enabled);
        setTpPercent(String(data.tp_percent));
        setSlPercent(String(data.sl_percent));
        setRiskAmount(String(data.risk_amount));
        setPairsText((data.pairs || []).join(', '));
        setTelegramToken(data.telegram_token || '');
        setTelegramChatId(data.telegram_chat_id || '');
        setBinanceApiKey(data.binance_api_key || '');
        setBinanceSecretKey(data.binance_secret_key || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg({ type: '', text: '' });

    // Format pairs text into clean array
    const pairsArray = pairsText
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter((p) => p.length > 0);

    const payload = {
      bot_enabled: botEnabled,
      tp_percent: parseFloat(tpPercent),
      sl_percent: parseFloat(slPercent),
      risk_amount: parseFloat(riskAmount),
      pairs: pairsArray,
      telegram_token: telegramToken,
      telegram_chat_id: telegramChatId,
      binance_api_key: binanceApiKey,
      binance_secret_key: binanceSecretKey,
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ type: 'success', text: 'Configuration saved successfully!' });
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#3b82f6'],
        });
        
        // Refresh settings so masked versions reload if newly set
        fetchSettings();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save settings.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading settings terminal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">System Settings</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Configure bot leverage, target tickers, bracket order ratios, and external APIs.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Strategy Parameters */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <h3 className="text-lg font-bold text-zinc-200 border-b border-zinc-800/50 pb-3 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>Strategy Parameters</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Take Profit */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Take Profit (TP %)</span>
                <span title="Exit target for profitable orders"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  required
                  value={tpPercent}
                  onChange={(e) => setTpPercent(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                  %
                </span>
              </div>
            </div>

            {/* Stop Loss */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Stop Loss (SL %)</span>
                <span title="Safety halt target for negative orders"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  required
                  value={slPercent}
                  onChange={(e) => setSlPercent(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                  %
                </span>
              </div>
            </div>

            {/* Risk Amount */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Risk Per Trade (Lot USDT)</span>
                <span title="Notional position allocation size in USDT"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  required
                  value={riskAmount}
                  onChange={(e) => setRiskAmount(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                  USDT
                </span>
              </div>
            </div>
          </div>

          {/* Active Pairs Array List */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Scanned Pairs (Comma separated)
            </label>
            <textarea
              rows={3}
              value={pairsText}
              onChange={(e) => setPairsText(e.target.value)}
              placeholder="BTCUSDT, ETHUSDT, SOLUSDT..."
              className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm leading-relaxed"
            />
            <p className="text-[10px] text-zinc-500 font-medium">
              Must enter valid Binance perpetual futures symbols in uppercase separated by commas.
            </p>
          </div>
        </div>

        {/* Telegram API configurations */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <h3 className="text-lg font-bold text-zinc-200 border-b border-zinc-800/50 pb-3">
            Telegram Alerts API
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Bot API Token
              </label>
              <div className="relative">
                <input
                  type={showTelegram ? 'text' : 'password'}
                  placeholder="123456789:ABCdefGhI..."
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowTelegram(!showTelegram)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showTelegram ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Chat ID / Channel ID
              </label>
              <input
                type="text"
                placeholder="-100123456789"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Binance API credentials */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <div className="border-b border-zinc-800/50 pb-3 flex justify-between items-center">
            <h3 className="text-lg font-bold text-zinc-200">Binance API Settings</h3>
            <span className="text-[10px] text-amber-500 bg-amber-950/20 border border-amber-900/50 rounded px-2 py-0.5 font-bold uppercase tracking-wider">
              Testnet Mode Enabled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showBinanceKey ? 'text' : 'password'}
                  placeholder="Binance Testnet API Key"
                  value={binanceApiKey}
                  onChange={(e) => setBinanceApiKey(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowBinanceKey(!showBinanceKey)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showBinanceKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Secret Key
              </label>
              <div className="relative">
                <input
                  type={showBinanceSecret ? 'text' : 'password'}
                  placeholder="Binance Testnet Secret Key"
                  value={binanceSecretKey}
                  onChange={(e) => setBinanceSecretKey(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowBinanceSecret(!showBinanceSecret)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showBinanceSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-950/20 border border-amber-900/50 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                Warning / Alert
              </p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Ensure your Binance Futures Testnet API Key has **Enable Futures** checked. Do not use Mainnet API credentials! The system is locked to the sandbox environment for capital safety.
              </p>
            </div>
          </div>
        </div>

        {/* Status Msg & Save Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 rounded-3xl">
          <div>
            {statusMsg.text && (
              <span
                className={`text-sm font-semibold ${
                  statusMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {statusMsg.text}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-semibold transition-all duration-200 shadow-md shadow-emerald-500/10 cursor-pointer"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Terminal Configuration...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
