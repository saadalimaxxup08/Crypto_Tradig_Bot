'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, HelpCircle, Eye, EyeOff, TrendingUp } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SettingsPage() {
  const [botEnabled, setBotEnabled] = useState(false);
  const [tpPercent, setTpPercent] = useState('2.0');
  const [slPercent, setSlPercent] = useState('1.0');
  const [riskAmount, setRiskAmount] = useState('10.0');
  const [leverage, setLeverage] = useState('20');
  const [maxOpenTrades, setMaxOpenTrades] = useState('10');
  const [activeStrategy, setActiveStrategy] = useState('RSI_MACD');
  const [pairsText, setPairsText] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [tradingMode, setTradingMode] = useState<'DEMO' | 'REAL'>('DEMO');
  const [binanceDemoApiKey, setBinanceDemoApiKey] = useState('');
  const [binanceDemoSecretKey, setBinanceDemoSecretKey] = useState('');
  const [binanceRealApiKey, setBinanceRealApiKey] = useState('');
  const [binanceRealSecretKey, setBinanceRealSecretKey] = useState('');
  const [cooldownHours, setCooldownHours] = useState('0.0');

  // Deriv Settings States
  const [derivAppId, setDerivAppId] = useState('');
  const [derivApiToken, setDerivApiToken] = useState('');
  const [derivDemoAccount, setDerivDemoAccount] = useState('');
  const [derivRealAccount, setDerivRealAccount] = useState('');
  const [derivTradingMode, setDerivTradingMode] = useState<'DEMO' | 'REAL'>('DEMO');
  const [derivBotEnabled, setDerivBotEnabled] = useState(false);

  // WhatsApp Bridge states
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappRecipients, setWhatsappRecipients] = useState<string[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [whatsappUser, setWhatsappUser] = useState<string | null>(null);
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [newRecipient, setNewRecipient] = useState('');
  const [isCheckingWhatsapp, setIsCheckingWhatsapp] = useState(false);
  const [whatsappFilters, setWhatsappFilters] = useState({
    signals: true,
    trades: true,
    hourly: false,
    daily: false
  });

  const fetchWhatsAppConfig = async () => {
    try {
      const res = await fetch('/api/whatsapp/config');
      if (res.ok) {
        const data = await res.json();
        setWhatsappEnabled(data.whatsapp_enabled);
        setWhatsappRecipients(data.whatsapp_recipients || []);
        if (data.whatsapp_filters) {
          setWhatsappFilters(data.whatsapp_filters);
        }
      }
    } catch (err) {
      console.error('Failed to load WhatsApp config:', err);
    }
  };

  const checkWhatsAppStatus = async () => {
    setIsCheckingWhatsapp(true);
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setWhatsappStatus(data.status);
        setWhatsappUser(data.user);
        setWhatsappQr(data.qr);
      }
    } catch (err) {
      console.error('Failed to load WhatsApp status:', err);
    } finally {
      setIsCheckingWhatsapp(false);
    }
  };

  const handleSaveWhatsAppConfig = async (enabled: boolean, recipients: string[], filters = whatsappFilters) => {
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_enabled: enabled,
          whatsapp_recipients: recipients,
          whatsapp_filters: filters
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsappEnabled(data.config.whatsapp_enabled);
        setWhatsappRecipients(data.config.whatsapp_recipients || []);
        if (data.config.whatsapp_filters) {
          setWhatsappFilters(data.config.whatsapp_filters);
        }
      }
    } catch (err) {
      console.error('Failed to save WhatsApp config:', err);
    }
  };

  const handleUnlinkWhatsApp = async () => {
    if (!confirm('Are you sure you want to unlink WhatsApp?')) return;
    try {
      const res = await fetch('/api/whatsapp/status', { method: 'POST' });
      if (res.ok) {
        checkWhatsAppStatus();
      }
    } catch (err) {
      console.error('Failed to unlink WhatsApp:', err);
    }
  };

  const [testingRecipients, setTestingRecipients] = useState<Record<string, boolean>>({});
  const [sentRecipients, setSentRecipients] = useState<Record<string, boolean>>({});

  const handleTestRecipient = async (recipient: string) => {
    setTestingRecipients((prev) => ({ ...prev, [recipient]: true }));
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSentRecipients((prev) => ({ ...prev, [recipient]: true }));
        setTimeout(() => {
          setSentRecipients((prev) => ({ ...prev, [recipient]: false }));
        }, 3000);
      } else {
        alert(`Failed to send test message: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error sending test: ${err.message}`);
    } finally {
      setTestingRecipients((prev) => ({ ...prev, [recipient]: false }));
    }
  };

  // WhatsApp Pairing states
  const [linkMethod, setLinkMethod] = useState<'qr' | 'phone'>('qr');
  const [pairPhone, setPairPhone] = useState('');
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [isGeneratingPairCode, setIsGeneratingPairCode] = useState(false);

  const handleGetPairingCode = async () => {
    if (!pairPhone) {
      alert('Please enter a phone number first.');
      return;
    }
    setIsGeneratingPairCode(true);
    setPairCode(null);
    try {
      const res = await fetch('/api/whatsapp/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: pairPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPairCode(data.code);
        setWhatsappStatus('connecting'); // Trigger background status polling loop!
      } else {
        alert(`Failed to get pairing code: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error requesting pairing code: ${err.message}`);
    } finally {
      setIsGeneratingPairCode(false);
    }
  };

  // Pair Specific Overrides States
  const [pairOverrides, setPairOverrides] = useState<Record<string, any>>({});
  const [overridePair, setOverridePair] = useState('');
  const [overrideLeverage, setOverrideLeverage] = useState('');
  const [overrideMargin, setOverrideMargin] = useState('');
  const [overrideTp, setOverrideTp] = useState('');
  const [overrideSl, setOverrideSl] = useState('');

  const addOverride = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!overridePair) return;
    const newOverrides = { ...pairOverrides };
    newOverrides[overridePair] = {
      leverage: overrideLeverage ? parseInt(overrideLeverage) : undefined,
      risk_amount: overrideMargin ? parseFloat(overrideMargin) : undefined,
      tp_percent: overrideTp ? parseFloat(overrideTp) : undefined,
      sl_percent: overrideSl ? parseFloat(overrideSl) : undefined,
    };
    // Strip undefined values to keep the database tidy
    Object.keys(newOverrides[overridePair]).forEach(k => {
      if (newOverrides[overridePair][k] === undefined) {
        delete newOverrides[overridePair][k];
      }
    });
    // Remove entire object if completely empty
    if (Object.keys(newOverrides[overridePair]).length === 0) {
      delete newOverrides[overridePair];
    }
    setPairOverrides(newOverrides);
    setOverridePair('');
    setOverrideLeverage('');
    setOverrideMargin('');
    setOverrideTp('');
    setOverrideSl('');
  };

  const deleteOverride = (pairToDel: string) => {
    const newOverrides = { ...pairOverrides };
    delete newOverrides[pairToDel];
    setPairOverrides(newOverrides);
  };

  const editOverride = (pair: string, o: any) => {
    setOverridePair(pair);
    setOverrideMargin(o.risk_amount !== undefined ? o.risk_amount.toString() : '');
    setOverrideLeverage(o.leverage !== undefined ? o.leverage.toString() : '');
    setOverrideTp(o.tp_percent !== undefined ? o.tp_percent.toString() : '');
    setOverrideSl(o.sl_percent !== undefined ? o.sl_percent.toString() : '');
  };

  const [showTelegram, setShowTelegram] = useState(false);
  const [showBinanceDemoKey, setShowBinanceDemoKey] = useState(false);
  const [showBinanceDemoSecret, setShowBinanceDemoSecret] = useState(false);
  const [showBinanceRealKey, setShowBinanceRealKey] = useState(false);
  const [showBinanceRealSecret, setShowBinanceRealSecret] = useState(false);
  const [showDerivToken, setShowDerivToken] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const [res, resDeriv] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/deriv/settings')
      ]);
      
      const data = await res.json();
      const derivData = await resDeriv.json();

      if (res.ok) {
        setBotEnabled(data.bot_enabled);
        setTpPercent(String(data.tp_percent));
        setSlPercent(String(data.sl_percent));
        setRiskAmount(String(data.risk_amount));
        setLeverage(String(data.leverage || 20));
        setMaxOpenTrades(String(data.max_open_trades !== undefined ? data.max_open_trades : 10));
        setPairsText((data.pairs || []).join(', '));
        setTelegramToken(data.telegram_token || '');
        setTelegramChatId(data.telegram_chat_id || '');
        setTradingMode(data.trading_mode || 'DEMO');
        setBinanceDemoApiKey(data.binance_demo_api_key || '');
        setBinanceDemoSecretKey(data.binance_demo_secret_key || '');
        setBinanceRealApiKey(data.binance_real_api_key || '');
        setBinanceRealSecretKey(data.binance_real_secret_key || '');
        const overrides = data.pair_overrides || {};
        setCooldownHours(String(overrides.GLOBAL_COOLDOWN_HOURS || '0.0'));
        setPairOverrides(overrides);
        setActiveStrategy(data.active_strategy || 'RSI_MACD');
      }

      if (resDeriv.ok && derivData.success) {
        setDerivAppId(derivData.appId || '');
        setDerivApiToken(derivData.apiToken || '');
        setDerivDemoAccount(derivData.demoAccount || '');
        setDerivRealAccount(derivData.realAccount || '');
        setDerivTradingMode(derivData.tradingMode || 'DEMO');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchWhatsAppConfig();
    checkWhatsAppStatus();
  }, []);

  useEffect(() => {
    let interval: any;
    if (whatsappStatus === 'connecting' || (whatsappStatus === 'disconnected' && whatsappQr)) {
      interval = setInterval(() => {
        checkWhatsAppStatus();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [whatsappStatus, whatsappQr]);

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
      leverage: parseInt(leverage),
      max_open_trades: parseInt(maxOpenTrades),
      active_strategy: activeStrategy,
      trading_mode: tradingMode,
      pairs: pairsArray,
      telegram_token: telegramToken,
      telegram_chat_id: telegramChatId,
      binance_demo_api_key: binanceDemoApiKey,
      binance_demo_secret_key: binanceDemoSecretKey,
      binance_real_api_key: binanceRealApiKey,
      binance_real_secret_key: binanceRealSecretKey,
      pair_overrides: {
        ...pairOverrides,
        GLOBAL_COOLDOWN_HOURS: parseFloat(cooldownHours || '0.0')
      },
    };

    try {
      const [res, resDeriv] = await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch('/api/deriv/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: derivAppId,
            apiToken: derivApiToken,
            demoAccount: derivDemoAccount,
            realAccount: derivRealAccount,
            tradingMode: derivTradingMode,
          }),
        })
      ]);

      const data = await res.json();
      const derivData = await resDeriv.json();

      if (res.ok && data.success && resDeriv.ok && derivData.success) {
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
        const errorText = (!res.ok || !data.success)
          ? (data.error || 'Failed to save Binance settings.')
          : (derivData.error || 'Failed to save Deriv settings. Please verify Supabase settings columns exist.');
        setStatusMsg({ type: 'error', text: errorText });
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

            {/* Margin per Trade */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Margin Per Trade</span>
                <span title="Collateral margin size in USDT"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
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

            {/* Leverage Multiplier */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Leverage Multiplier</span>
                <span title="Binance Futures leverage coefficient"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  required
                  min="1"
                  max="125"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                  x
                </span>
              </div>
            </div>

            {/* Max Open Trades Limit */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Max Open Trades Limit</span>
                <span title="Maximum number of concurrent open positions allowed"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  required
                  min="1"
                  max="100"
                  value={maxOpenTrades}
                  onChange={(e) => setMaxOpenTrades(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                  trades
                </span>
              </div>
            </div>
          </div>

          {/* Active Trading Strategy Selector */}
          <div className="space-y-2 max-w-md">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <span>Active Trading Strategy</span>
              <span title="Select the indicator strategy used by the automated bot"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>
            <select
              value={activeStrategy}
              onChange={(e) => setActiveStrategy(e.target.value)}
              className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3.5 px-4 font-bold text-zinc-200 focus:outline-none transition-all duration-200 text-sm cursor-pointer"
            >
              <option value="RSI_MACD">📊 RSI + MACD Momentum Crossover (Default)</option>
              <option value="COMBINATION_STRATEGIES">💼 Combination Portfolio Dispatcher</option>
              <option value="REGIME_ENSEMBLE_PRO">🛡️ Regime-Aware Ensemble Pro (Consensus)</option>
              <option value="BOLLINGER_RSI">↕️ Bollinger Bands + RSI Range Reversion</option>
              <option value="BOLLINGER_RSI_OPT">↕️ Bollinger Bands + RSI Range Reversion (Optimized)</option>
              <option value="DOUBLE_EMA">🎢 Double EMA Crossover Trend Following (1m)</option>
              <option value="DOUBLE_EMA_OPT">🎢 Double EMA Crossover (Optimized)</option>
              <option value="DOUBLE_EMA_5M">🎢 Double EMA 5-Minute (Trend + Volume)</option>
              <option value="DOUBLE_EMA_15M">🎢 Double EMA 15-Minute (Trend + Volume)</option>
              <option value="SUPERTREND_EMA">⚡ SuperTrend + 200 EMA Trend Following</option>
              <option value="SUPERTREND_EMA_OPT">⚡ SuperTrend + 200 EMA (Optimized)</option>
              <option value="STOCH_RSI_MACD">🚀 Stochastic RSI + MACD Crossover</option>
              <option value="ATR_BREAKOUT">🎢 ATR Channel Breakout</option>
              <option value="SWING_STRUCTURE">🛡️ Swing S&R Structure Trend Following</option>
              <option value="KDJ_REVERSION">↕️ KDJ + StochRSI Reversion</option>
              <option value="KDJ_REVERSION_OPT">↕️ KDJ + StochRSI Reversion (Optimized)</option>
              <option value="FIBONACCI_PULLBACK">🎢 EMA Fibonacci Pullback</option>
              <option value="ICHIMOKU_CLOUDBREAK">☁️ Ichimoku Cloud Breakout</option>
              <option value="VWAP_REVERSION">⚡ VWAP Volatility Band Reversion</option>
              <option value="VWAP_REVERSION_OPT">⚡ VWAP Volatility Band Reversion (Optimized)</option>
              <option value="RSI_STOCH_EMA_TREND">📈 RSI + Stoch + EMA Trend Pullback</option>
              <option value="CMF_BREAKOUT">💰 Chaikin Money Flow Breakout</option>
              <option value="HULL_MA_CROSSOVER">🌊 Hull Moving Average Crossover</option>
              <option value="DONCHIAN_BREAKOUT">📦 Donchian Channel Breakout</option>
              <option value="ADX_DI_MOMENTUM">💥 ADX DI Momentum Crossover</option>
            </select>
          </div>

          {/* Post-Trade Cooldown Setting */}
          <div className="space-y-2 max-w-md">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <span>Post-Trade Cooldown (Hours)</span>
              <span title="Wait hours after closing a trade before opening a new one on the same pair. Set to 0.0 to disable completely."><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(e.target.value)}
              placeholder="e.g. 1.0"
              className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
            />
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

        {/* Pair Specific Overrides */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-zinc-200 border-b border-zinc-800/50 pb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <span>Pair-Specific Risk Overrides</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Set custom leverage, margin size, or TP/SL targets for specific assets (e.g. higher margin for BTC/ETH to satisfy exchange minimum limits, lower leverage for high-volatility pairs). If no override exists, the global strategy settings above are used automatically.
            </p>
          </div>

          {/* Add Override Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end bg-zinc-950/20 border border-zinc-800/50 p-4 rounded-2xl">
            {/* Pair Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Target Asset</label>
              <select
                value={overridePair}
                onChange={(e) => setOverridePair(e.target.value)}
                className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500 rounded-xl py-3 px-3 font-mono text-zinc-100 focus:outline-none text-xs"
              >
                <option value="">Select Pair...</option>
                {pairsText.split(',').map(p => p.trim().toUpperCase()).filter(p => p.length > 0).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Custom Margin */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Margin (USDT)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 5.0"
                value={overrideMargin}
                onChange={(e) => setOverrideMargin(e.target.value)}
                className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500 rounded-xl py-3 px-3 font-mono text-zinc-100 focus:outline-none text-xs"
              />
            </div>

            {/* Custom Leverage */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Leverage (X)</label>
              <input
                type="number"
                step="1"
                placeholder="e.g. 10"
                value={overrideLeverage}
                onChange={(e) => setOverrideLeverage(e.target.value)}
                className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500 rounded-xl py-3 px-3 font-mono text-zinc-100 focus:outline-none text-xs"
              />
            </div>

            {/* Custom TP / SL */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TP / SL (%)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="TP %"
                  value={overrideTp}
                  onChange={(e) => setOverrideTp(e.target.value)}
                  className="w-1/2 bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500 rounded-xl py-3 px-2 font-mono text-zinc-100 focus:outline-none text-xs text-center"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="SL %"
                  value={overrideSl}
                  onChange={(e) => setOverrideSl(e.target.value)}
                  className="w-1/2 bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500 rounded-xl py-3 px-2 font-mono text-zinc-100 focus:outline-none text-xs text-center"
                />
              </div>
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={addOverride}
              className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              Add Override
            </button>
          </div>

          {/* Active Overrides Table/List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Active Pair Overrides</h4>
            {Object.keys(pairOverrides).length === 0 ? (
              <div className="p-6 border border-dashed border-zinc-800/80 rounded-2xl text-center text-zinc-500 text-xs">
                No active overrides. All pairs are using global settings.
              </div>
            ) : (
              <div className="overflow-x-auto border border-zinc-800/60 rounded-2xl bg-zinc-950/10">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/20 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="p-3">Asset</th>
                      <th className="p-3 text-right">Margin Size</th>
                      <th className="p-3 text-right">Leverage</th>
                      <th className="p-3 text-right">Take Profit</th>
                      <th className="p-3 text-right">Stop Loss</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {Object.entries(pairOverrides).map(([pair, o]: [string, any]) => (
                      <tr key={pair} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="p-3 font-bold text-zinc-200">{pair}</td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {o.risk_amount !== undefined ? `${o.risk_amount.toFixed(1)} USDT` : <span className="text-zinc-600 italic">Global fallback</span>}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {o.leverage !== undefined ? `${o.leverage}x` : <span className="text-zinc-600 italic">Global fallback</span>}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {o.tp_percent !== undefined ? `${o.tp_percent.toFixed(1)}%` : <span className="text-zinc-600 italic">Global fallback</span>}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {o.sl_percent !== undefined ? `${o.sl_percent.toFixed(1)}%` : <span className="text-zinc-600 italic">Global fallback</span>}
                        </td>
                        <td className="p-3 text-center space-x-2">
                          <button
                            type="button"
                            onClick={() => editOverride(pair, o)}
                            className="text-emerald-400 hover:text-emerald-350 font-bold px-2 py-1 rounded hover:bg-emerald-950/25 transition-all cursor-pointer text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOverride(pair)}
                            className="text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded hover:bg-red-950/25 transition-all cursor-pointer text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

        {/* WhatsApp Notification Bridge */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <div className="border-b border-zinc-800/50 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-200">WhatsApp Notification Bridge</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Forward real-time signal notifications to WhatsApp contacts or groups for FREE</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                whatsappStatus === 'connected'
                  ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400'
                  : whatsappStatus === 'connecting'
                  ? 'bg-amber-950/20 border-amber-900/50 text-amber-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}>
                {whatsappStatus === 'connected' ? `Connected: +${whatsappUser}` : whatsappStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>

              <button
                type="button"
                onClick={() => {
                  const newEnabled = !whatsappEnabled;
                  setWhatsappEnabled(newEnabled);
                  handleSaveWhatsAppConfig(newEnabled, whatsappRecipients);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  whatsappEnabled
                    ? 'bg-emerald-500 text-zinc-950 shadow-md animate-pulse'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                {whatsappEnabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left side: QR code scanner link */}
            <div className="bg-[#09090b]/40 border border-zinc-850 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 self-start">Link Mobile Device</h4>
              
              {whatsappStatus === 'connected' ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                  <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-full text-emerald-400 animate-pulse">
                    <TrendingUp className="w-10 h-10" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-zinc-200">Device Successfully Linked!</h5>
                    <p className="text-xs text-zinc-400 mt-1">Ready to forward trading signals as WhatsApp messages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkWhatsApp}
                    className="px-4 py-2 border border-red-900/50 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-bold rounded-xl cursor-pointer transition-all"
                  >
                    Unlink Device
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full py-2 text-center">
                  {/* Segmented Switcher */}
                  <div className="flex bg-[#0f0f13] p-1 border border-zinc-850 rounded-xl mb-6 w-full max-w-[260px]">
                    <button
                      type="button"
                      onClick={() => setLinkMethod('qr')}
                      className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                        linkMethod === 'qr' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-550 hover:text-zinc-350'
                      }`}
                    >
                      Scan QR Barcode
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkMethod('phone')}
                      className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                        linkMethod === 'phone' ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-550 hover:text-zinc-350'
                      }`}
                    >
                      Phone Pairing Code
                    </button>
                  </div>

                  {linkMethod === 'qr' ? (
                    <div className="flex flex-col items-center justify-center w-full space-y-4">
                      {whatsappQr ? (
                        <div className="bg-white p-3 rounded-2xl shadow-lg animate-fade-in">
                          <img src={whatsappQr} alt="WhatsApp Link QR" className="w-48 h-48" />
                        </div>
                      ) : (
                        <div className="w-48 h-48 border border-dashed border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-650 text-xs text-center px-4">
                          {isCheckingWhatsapp ? 'Loading QR Code...' : 'Click button below to generate linking QR code.'}
                        </div>
                      )}

                      <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                        Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Scan QR code.
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={checkWhatsAppStatus}
                          className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-850 text-zinc-400 text-xs font-bold rounded-xl cursor-pointer transition-all"
                        >
                          {isCheckingWhatsapp ? 'Generating...' : whatsappQr ? 'Refresh QR' : 'Link Device'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full space-y-4">
                      {pairCode ? (
                        <div className="bg-[#0f0f13] border border-zinc-800 px-6 py-4 rounded-2xl animate-fade-in shadow-inner">
                          <span className="text-2xl font-mono font-bold tracking-widest text-emerald-400">
                            {pairCode.slice(0, 4)} - {pairCode.slice(4)}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full max-w-[240px] px-3 py-4 border border-zinc-850 rounded-2xl flex flex-col items-center justify-center space-y-2 bg-[#09090b]/20">
                          <input
                            type="text"
                            placeholder="e.g. +923111594226"
                            value={pairPhone}
                            onChange={(e) => setPairPhone(e.target.value)}
                            className="w-full text-center text-xs font-bold bg-[#09090b]/80 border border-zinc-800 px-3 py-2 rounded-xl text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 font-mono"
                          />
                          <p className="text-[10px] text-zinc-550">Include country code (e.g. 92...)</p>
                        </div>
                      )}

                      <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                        {pairCode ? (
                          <>
                            Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link with phone number instead &gt; Enter code above.
                          </>
                        ) : (
                          <>
                            Enter your phone number (with country code) to generate a WhatsApp Web pairing code.
                          </>
                        )}
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isGeneratingPairCode}
                          onClick={handleGetPairingCode}
                          className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-850 text-zinc-400 text-xs font-bold rounded-xl cursor-pointer transition-all disabled:opacity-50"
                        >
                          {isGeneratingPairCode ? 'Generating...' : pairCode ? 'Get New Code' : 'Get Pairing Code'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right side: Recipients Manager */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Manage Recipients / Groups</h4>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. +923001234567 or group-id"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  className="flex-1 bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-2.5 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const formatted = newRecipient.trim();
                    if (!formatted) return;
                    // Prevent duplicates
                    if (whatsappRecipients.includes(formatted)) return;
                    const updated = [...whatsappRecipients, formatted];
                    setWhatsappRecipients(updated);
                    handleSaveWhatsAppConfig(whatsappEnabled, updated);
                    setNewRecipient('');
                  }}
                  className="px-4 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center font-bold"
                >
                  Add
                </button>
              </div>

              <div className="bg-[#09090b]/40 border border-zinc-850 rounded-2xl p-4 max-h-[180px] overflow-y-auto space-y-2">
                {whatsappRecipients.length === 0 ? (
                  <p className="text-xs text-zinc-550 text-center py-6 font-medium">No recipients added yet. Add a phone number or group ID above.</p>
                ) : (
                  whatsappRecipients.map((rec) => (
                    <div key={rec} className="flex justify-between items-center bg-[#09090b]/80 border border-zinc-800/60 px-3 py-2 rounded-xl">
                      <span className="text-xs font-mono text-zinc-350">{rec}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={testingRecipients[rec]}
                          onClick={() => handleTestRecipient(rec)}
                          className="text-emerald-400 hover:text-emerald-350 font-bold px-2 py-1 rounded hover:bg-emerald-950/25 transition-all cursor-pointer text-xs disabled:opacity-50"
                        >
                          {testingRecipients[rec] ? 'Sending...' : sentRecipients[rec] ? 'Sent! ✅' : 'Test'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = whatsappRecipients.filter((r) => r !== rec);
                            setWhatsappRecipients(updated);
                            handleSaveWhatsAppConfig(whatsappEnabled, updated);
                          }}
                          className="text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded hover:bg-red-950/25 transition-all cursor-pointer text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Filters Checklist */}
              <div className="pt-4 border-t border-zinc-850/80 space-y-3">
                <div className="flex flex-col">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">WhatsApp Notification Filters</h4>
                  <p className="text-[10px] text-zinc-550 mt-0.5">Select which categories of alerts are forwarded to WhatsApp</p>
                </div>
                
                <div className="bg-[#09090b]/40 border border-zinc-850 rounded-2xl p-4 space-y-3">
                  {[
                    { id: 'signals', label: 'New Trading Signals', desc: 'Forward new EMA crossover, ATR breakout, and structure entry alerts.' },
                    { id: 'trades', label: 'Trade Executions', desc: 'Forward order triggers, execution events, and position close reports.' },
                    { id: 'hourly', label: 'Hourly Performance Reports', desc: 'Forward hourly account balance checks.' },
                    { id: 'daily', label: 'Daily Summaries', desc: 'Forward daily performance and backtest leaderboard audits.' }
                  ].map((filter) => (
                    <label key={filter.id} className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={(whatsappFilters as any)[filter.id]}
                        onChange={(e) => {
                          const updatedFilters = {
                            ...whatsappFilters,
                            [filter.id]: e.target.checked
                          };
                          setWhatsappFilters(updatedFilters);
                          handleSaveWhatsAppConfig(whatsappEnabled, whatsappRecipients, updatedFilters);
                        }}
                        className="mt-1 rounded border-zinc-800 bg-[#09090b] text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-500 w-3.5 h-3.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-zinc-350 group-hover:text-zinc-200 transition-all">{filter.label}</span>
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{filter.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Binance API credentials */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <div className="border-b border-zinc-800/50 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-200">Binance API Settings</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Toggle between Demo Sandbox and Real Account trading</p>
            </div>
            
            {/* Toggles Container */}
            <div className="flex flex-wrap gap-3 items-center self-start sm:self-auto">
              {/* Bot Work Status */}
              <div className="flex bg-[#09090b]/80 border border-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBotEnabled(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    botEnabled
                      ? 'bg-emerald-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  WORK ON
                </button>
                <button
                  type="button"
                  onClick={() => setBotEnabled(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !botEnabled
                      ? 'bg-red-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  WORK OFF
                </button>
              </div>

              {/* Segmented Switcher */}
              <div className="flex bg-[#09090b]/80 border border-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTradingMode('DEMO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tradingMode === 'DEMO'
                      ? 'bg-amber-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  DEMO SANDBOX
                </button>
                <button
                  type="button"
                  onClick={() => setTradingMode('REAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tradingMode === 'REAL'
                      ? 'bg-emerald-500 text-zinc-950 shadow-md animate-pulse'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  REAL LIVE
                </button>
              </div>
            </div>
          </div>

          {tradingMode === 'DEMO' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Demo API Key */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Demo API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showBinanceDemoKey ? 'text' : 'password'}
                      placeholder="Binance Testnet API Key"
                      value={binanceDemoApiKey}
                      onChange={(e) => setBinanceDemoApiKey(e.target.value)}
                      className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBinanceDemoKey(!showBinanceDemoKey)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showBinanceDemoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Demo Secret Key */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Demo Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showBinanceDemoSecret ? 'text' : 'password'}
                      placeholder="Binance Testnet Secret Key"
                      value={binanceDemoSecretKey}
                      onChange={(e) => setBinanceDemoSecretKey(e.target.value)}
                      className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBinanceDemoSecret(!showBinanceDemoSecret)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showBinanceDemoSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-950/15 border border-amber-900/30 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                    Demo Sandbox Settings
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Make sure to use keys generated from the <b>Binance Futures Testnet / Demo trading</b> website. Ensure the key has <b>Enable Futures</b> checked in its API restrictions.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Real API Key */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Live Real API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showBinanceRealKey ? 'text' : 'password'}
                      placeholder="Binance Mainnet API Key"
                      value={binanceRealApiKey}
                      onChange={(e) => setBinanceRealApiKey(e.target.value)}
                      className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBinanceRealKey(!showBinanceRealKey)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showBinanceRealKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Real Secret Key */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Live Real Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showBinanceRealSecret ? 'text' : 'password'}
                      placeholder="Binance Mainnet Secret Key"
                      value={binanceRealSecretKey}
                      onChange={(e) => setBinanceRealSecretKey(e.target.value)}
                      className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBinanceRealSecret(!showBinanceRealSecret)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showBinanceRealSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-2xl flex items-start gap-3 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wide">
                    🚨 LIVE TRADING RISK WARNING
                  </p>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    You are enabling <b>Live Trading mode</b>. Every signal triggered will execute positions on the real Binance Futures market using <b>REAL CAPITAL</b>. Ensure your API Key restrictions are set to **Enable Futures** and that **Enable Withdrawals is UNCHECKED (Disabled)** for security.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Deriv API credentials */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <div className="border-b border-zinc-800/50 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-200">Deriv API Settings</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Toggle between Demo Sandbox and Real Account options trading</p>
            </div>
            
            {/* Toggles Container */}
            <div className="flex flex-wrap gap-3 items-center self-start sm:self-auto">
              {/* Bot Work Status */}
              <div className="flex bg-[#09090b]/80 border border-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDerivBotEnabled(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    derivBotEnabled
                      ? 'bg-emerald-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  WORK ON
                </button>
                <button
                  type="button"
                  onClick={() => setDerivBotEnabled(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !derivBotEnabled
                      ? 'bg-red-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  WORK OFF
                </button>
              </div>

              {/* Segmented Switcher */}
              <div className="flex bg-[#09090b]/80 border border-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDerivTradingMode('DEMO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    derivTradingMode === 'DEMO'
                      ? 'bg-amber-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  DEMO SANDBOX
                </button>
                <button
                  type="button"
                  onClick={() => setDerivTradingMode('REAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    derivTradingMode === 'REAL'
                      ? 'bg-emerald-500 text-zinc-950 shadow-md animate-pulse'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  REAL LIVE
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Deriv App ID */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Deriv App ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 34eMOq..."
                  value={derivAppId}
                  onChange={(e) => setDerivAppId(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-650 focus:outline-none transition-all duration-200 text-sm"
                  required
                />
              </div>

              {/* Deriv API Token (PAT) */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Deriv API Token (PAT)
                </label>
                <div className="relative">
                  <input
                    type={showDerivToken ? 'text' : 'password'}
                    placeholder="pat_..."
                    value={derivApiToken}
                    onChange={(e) => setDerivApiToken(e.target.value)}
                    className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 pl-4 pr-11 font-mono text-zinc-100 placeholder-zinc-650 focus:outline-none transition-all duration-200 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowDerivToken(!showDerivToken)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showDerivToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Demo Account ID */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Demo Account ID (Practice)
                </label>
                <input
                  type="text"
                  placeholder="DOT..."
                  value={derivDemoAccount}
                  onChange={(e) => setDerivDemoAccount(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                  required
                />
              </div>

              {/* Real Account ID */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Real Account ID (Live)
                </label>
                <input
                  type="text"
                  placeholder="ROT..."
                  value={derivRealAccount}
                  onChange={(e) => setDerivRealAccount(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-650 focus:outline-none transition-all duration-200 text-sm"
                />
              </div>
            </div>

            {derivTradingMode === 'DEMO' ? (
              <div className="p-4 bg-amber-950/15 border border-amber-900/30 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">
                    Deriv Demo Sandbox Active
                  </p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Options trading is running in <b>Demo Sandbox</b> mode. Trades will execute virtual balances on your Deriv Demo ID.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-2xl flex items-start gap-3 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wide">
                    🚨 LIVE OPTIONS RISK WARNING
                  </p>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    You are enabling <b>Live Real Trading mode</b> for Deriv Options. Every signal triggered will execute positions on your real Deriv Account using <b>REAL CAPITAL</b>.
                  </p>
                </div>
              </div>
            )}
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
