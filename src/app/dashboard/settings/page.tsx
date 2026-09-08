'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, HelpCircle, Eye, EyeOff, Shield, Sliders, CheckSquare } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SettingsPage() {
  // Deriv Settings States
  const [derivAppId, setDerivAppId] = useState('');
  const [derivApiToken, setDerivApiToken] = useState('');
  const [derivDemoAccount, setDerivDemoAccount] = useState('');
  const [derivRealAccount, setDerivRealAccount] = useState('');
  const [derivTradingMode, setDerivTradingMode] = useState<'DEMO' | 'REAL'>('DEMO');
  const [derivBotEnabled, setDerivBotEnabled] = useState(false);
  const [showDerivToken, setShowDerivToken] = useState(false);

  // Deriv Risk & Strategy Parameters
  const [derivStakeAmount, setDerivStakeAmount] = useState('1.00');
  const [derivMaxTrades, setDerivMaxTrades] = useState('10');
  const [derivSelectedPairsText, setDerivSelectedPairsText] = useState(
    'frxEURUSD, frxGBPUSD, frxUSDJPY, R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V'
  );
  const [derivActiveStrategies, setDerivActiveStrategies] = useState<string[]>([
    'FOREX_15M_MTF',
    'DERIV_INDEX_5M',
    'DERIV_OPTION_30M'
  ]);
  const [derivNewsFilterEnabled, setDerivNewsFilterEnabled] = useState(true);
  const [derivSessionFilterEnabled, setDerivSessionFilterEnabled] = useState(true);
  const [derivCooldownFilterEnabled, setDerivCooldownFilterEnabled] = useState(true);
  const [derivDailyLimitEnabled, setDerivDailyLimitEnabled] = useState(true);
  const [derivProgressionEnabled, setDerivProgressionEnabled] = useState(false);
  const [derivProgressionSteps, setDerivProgressionSteps] = useState<string[]>([
    '0.35', '0.39', '0.83', '1.75', '3.69', '7.79', '16.45', '34.73', '73.00', '150.00'
  ]);
  const [derivProgressionActiveSteps, setDerivProgressionActiveSteps] = useState<boolean[]>([
    true, true, true, true, true, true, true, true, true, true
  ]);

  // Telegram States
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [showTelegram, setShowTelegram] = useState(false);

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

  const [testingRecipients, setTestingRecipients] = useState<Record<string, boolean>>({});
  const [sentRecipients, setSentRecipients] = useState<Record<string, boolean>>({});

  // WhatsApp Pairing states
  const [linkMethod, setLinkMethod] = useState<'qr' | 'phone'>('qr');
  const [pairPhone, setPairPhone] = useState('');
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [isGeneratingPairCode, setIsGeneratingPairCode] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

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
        setWhatsappStatus('connecting');
      } else {
        alert(`Failed to get pairing code: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error requesting pairing code: ${err.message}`);
    } finally {
      setIsGeneratingPairCode(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const [resTelegram, resDeriv] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/deriv/settings')
      ]);

      const telegramData = await resTelegram.json();
      const derivData = await resDeriv.json();

      if (resTelegram.ok) {
        setTelegramToken(telegramData.telegram_token || '');
        setTelegramChatId(telegramData.telegram_chat_id || '');
      }

      if (resDeriv.ok && derivData.success) {
        setDerivAppId(derivData.appId || '');
        setDerivApiToken(derivData.apiToken || '');
        setDerivDemoAccount(derivData.demoAccount || '');
        setDerivRealAccount(derivData.realAccount || '');
        setDerivTradingMode(derivData.tradingMode || 'DEMO');
        setDerivBotEnabled(Boolean(derivData.botEnabled));

        if (derivData.derivStakeAmount !== undefined) {
          setDerivStakeAmount(String(derivData.derivStakeAmount));
        }
        if (derivData.derivMaxTrades !== undefined) {
          setDerivMaxTrades(String(derivData.derivMaxTrades));
        }
        if (derivData.derivSelectedPairs && Array.isArray(derivData.derivSelectedPairs)) {
          setDerivSelectedPairsText(derivData.derivSelectedPairs.join(', '));
        }
        if (derivData.activeStrategies && Array.isArray(derivData.activeStrategies)) {
          setDerivActiveStrategies(derivData.activeStrategies);
        }
        setDerivNewsFilterEnabled(derivData.derivNewsFilterEnabled !== false);
        setDerivSessionFilterEnabled(derivData.derivSessionFilterEnabled !== false);
        setDerivCooldownFilterEnabled(derivData.derivCooldownFilterEnabled !== false);
        setDerivDailyLimitEnabled(derivData.derivDailyLimitEnabled !== false);
        setDerivProgressionEnabled(Boolean(derivData.derivProgressionEnabled));
        if (derivData.derivProgressionSteps && Array.isArray(derivData.derivProgressionSteps) && derivData.derivProgressionSteps.length === 10) {
          setDerivProgressionSteps(derivData.derivProgressionSteps.map((s: any) => String(s)));
        }
        if (derivData.derivProgressionActiveSteps && Array.isArray(derivData.derivProgressionActiveSteps) && derivData.derivProgressionActiveSteps.length === 10) {
          setDerivProgressionActiveSteps(derivData.derivProgressionActiveSteps.map((b: any) => Boolean(b)));
        }
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

  const toggleStrategy = (stratKey: string) => {
    setDerivActiveStrategies((prev) =>
      prev.includes(stratKey) ? prev.filter((s) => s !== stratKey) : [...prev, stratKey]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg({ type: '', text: '' });

    const selectedPairsArray = derivSelectedPairsText
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    try {
      const [resTelegram, resDeriv] = await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_token: telegramToken,
            telegram_chat_id: telegramChatId,
          }),
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
            botEnabled: derivBotEnabled,
            activeStrategies: derivActiveStrategies,
            derivMaxTrades: parseInt(derivMaxTrades) || 10,
            derivStakeAmount: parseFloat(derivStakeAmount) || 1.00,
            derivSelectedPairs: selectedPairsArray,
            derivNewsFilterEnabled: derivNewsFilterEnabled,
            derivSessionFilterEnabled: derivSessionFilterEnabled,
            derivCooldownFilterEnabled: derivCooldownFilterEnabled,
            derivDailyLimitEnabled: derivDailyLimitEnabled,
            derivProgressionEnabled: derivProgressionEnabled,
            derivProgressionSteps: derivProgressionSteps.map(s => parseFloat(s) || 0.35),
            derivProgressionActiveSteps: derivProgressionActiveSteps
          }),
        })
      ]);

      const telegramData = await resTelegram.json();
      const derivData = await resDeriv.json();

      if (resTelegram.ok && telegramData.success && resDeriv.ok && derivData.success) {
        setStatusMsg({ type: 'success', text: 'Deriv configuration saved successfully!' });
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#3b82f6'],
        });
        fetchSettings();
      } else {
        const errorText = (!resDeriv.ok || !derivData.success)
          ? (derivData.error || 'Failed to save Deriv settings.')
          : (telegramData.error || 'Failed to save Telegram settings.');
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
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Loading Deriv settings terminal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Deriv Engine Settings</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Configure Deriv API tokens, execution strategies, stake risk limits, and real-time alerts.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Deriv API Credentials & Engine Controls */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <div className="border-b border-zinc-800/50 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-200">Deriv API Credentials</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Toggle between Demo Sandbox and Real Account trading</p>
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
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
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

        {/* Deriv Strategy Parameters & Risk Controls */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <h3 className="text-lg font-bold text-zinc-200 border-b border-zinc-800/50 pb-3 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <span>Deriv Strategy Parameters &amp; Risk Limits</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Stake Amount */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Stake Amount per Trade</span>
                <span title="Amount in USD per Deriv Binary Options contract"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  required
                  min="0.35"
                  value={derivStakeAmount}
                  onChange={(e) => setDerivStakeAmount(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                  USD
                </span>
              </div>
            </div>

            {/* Max Open Trades Limit */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <span>Max Open Trades Limit</span>
                <span title="Maximum concurrent active Deriv positions"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  required
                  min="1"
                  max="100"
                  value={derivMaxTrades}
                  onChange={(e) => setDerivMaxTrades(e.target.value)}
                  className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm"
                />
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-zinc-500">
                  trades
                </span>
              </div>
            </div>
          </div>

          {/* Active Deriv Strategies Checkboxes */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <span>Active Deriv Trading Engines</span>
              <span title="Select active Deriv strategy scan engines"><HelpCircle className="w-3.5 h-3.5 text-zinc-600" /></span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'FOREX_15M_MTF', label: 'Forex Major Pairs (15M MTF)', desc: 'Multi-timeframe RSI + EMA trend rider for EURUSD, GBPUSD, USDJPY' },
                { id: 'DERIV_INDEX_5M', label: 'Volatility Indices (5M)', desc: 'High-speed momentum breakout on Volatility 10, 25, 50, 75, 100' },
                { id: 'DERIV_OPTION_30M', label: 'Deriv Options (30M)', desc: 'Higher timeframe mean reversion and range breakout engine' }
              ].map((strat) => {
                const isActive = derivActiveStrategies.includes(strat.id);
                return (
                  <div
                    key={strat.id}
                    onClick={() => toggleStrategy(strat.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isActive
                        ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-[#09090b]/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{strat.label}</span>
                      <CheckSquare className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-600'}`} />
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{strat.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scanned Deriv Pairs */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Scanned Deriv Pairs (Comma separated)
            </label>
            <textarea
              rows={2}
              value={derivSelectedPairsText}
              onChange={(e) => setDerivSelectedPairsText(e.target.value)}
              placeholder="frxEURUSD, frxGBPUSD, frxUSDJPY, R_10, R_25, R_50, R_75, R_100..."
              className="w-full bg-[#09090b]/80 border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-xl py-3 px-4 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all duration-200 text-sm leading-relaxed"
            />
            <p className="text-[10px] text-zinc-500 font-medium">
              Enter valid Deriv Forex symbol IDs (frxEURUSD, frxGBPUSD, etc.) or Volatility Indices (R_10, R_25, R_50, R_75, R_100, 1HZ10V, 1HZ25V, 1HZ50V, 1HZ75V, 1HZ100V).
            </p>
          </div>

          {/* Safety Risk Control Filters */}
          <div className="space-y-3 pt-3 border-t border-zinc-800/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Safety Risk Control Filters</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-3.5 bg-[#09090b]/60 border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors">
                <div>
                  <span className="text-xs font-bold text-zinc-200">Daily Loss Limit Protection</span>
                  <p className="text-[10px] text-zinc-500">Halt trading if max daily loss threshold is hit</p>
                </div>
                <input
                  type="checkbox"
                  checked={derivDailyLimitEnabled}
                  onChange={(e) => setDerivDailyLimitEnabled(e.target.checked)}
                  className="rounded border-zinc-800 text-emerald-500 focus:ring-0 accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 bg-[#09090b]/60 border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors">
                <div>
                  <span className="text-xs font-bold text-zinc-200">Post-Trade Cooldown Filter</span>
                  <p className="text-[10px] text-zinc-500">Prevent back-to-back entries on the same asset</p>
                </div>
                <input
                  type="checkbox"
                  checked={derivCooldownFilterEnabled}
                  onChange={(e) => setDerivCooldownFilterEnabled(e.target.checked)}
                  className="rounded border-zinc-800 text-emerald-500 focus:ring-0 accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 bg-[#09090b]/60 border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors">
                <div>
                  <span className="text-xs font-bold text-zinc-200">High-Impact News Filter</span>
                  <p className="text-[10px] text-zinc-500">Pause forex entries 30m before high impact news</p>
                </div>
                <input
                  type="checkbox"
                  checked={derivNewsFilterEnabled}
                  onChange={(e) => setDerivNewsFilterEnabled(e.target.checked)}
                  className="rounded border-zinc-800 text-emerald-500 focus:ring-0 accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 bg-[#09090b]/60 border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors">
                <div>
                  <span className="text-xs font-bold text-zinc-200">Asian Session Volatility Filter</span>
                  <p className="text-[10px] text-zinc-500">Avoid low-liquidity chop during Asian session</p>
                </div>
                <input
                  type="checkbox"
                  checked={derivSessionFilterEnabled}
                  onChange={(e) => setDerivSessionFilterEnabled(e.target.checked)}
                  className="rounded border-zinc-800 text-emerald-500 focus:ring-0 accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Custom 10-Step Progression & Martingale Table */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/50 pb-4 gap-3">
            <div>
              <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <span>Custom 10-Step Progression &amp; Recovery Table</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Tick the steps you want to activate. When a trade loses, the bot moves to the next <b>ticked step</b>. As soon as <b>ANY trade WINS</b>, the bot resets back to Step 1. If <b>all ticked steps lose</b>, trading is automatically HALTED for risk protection!
              </p>
            </div>
            
            {/* RUN / OFF Master Switch */}
            <div className="flex items-center gap-3 bg-[#09090b]/80 border border-zinc-800 p-2 rounded-2xl self-start sm:self-auto">
              <span className={`text-xs font-extrabold uppercase tracking-wider ${derivProgressionEnabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {derivProgressionEnabled ? 'RUN (ON)' : 'OFF (NORMAL)'}
              </span>
              <button
                type="button"
                onClick={() => setDerivProgressionEnabled(!derivProgressionEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  derivProgressionEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                    derivProgressionEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {derivProgressionEnabled ? (
            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2">
              <span className="font-bold">⚡ PROGRESSION MODE ACTIVE:</span>
              <span>Bot will execute trades using ticked step inputs. If max ticked steps lose consecutively, trading automatically halts!</span>
            </div>
          ) : (
            <div className="p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-zinc-400 text-xs flex items-center gap-2">
              <span className="font-bold">ℹ️ NORMAL MODE ACTIVE:</span>
              <span>Bot executes fixed stake amount ($1.00 or custom base stake). Toggle RUN above to activate step progression.</span>
            </div>
          )}

          {/* 10 Step Inputs Grid with Checkboxes */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {derivProgressionSteps.map((stepVal, idx) => {
              const isChecked = derivProgressionActiveSteps[idx] !== false;
              return (
                <div
                  key={idx}
                  className={`border rounded-2xl p-3.5 space-y-2.5 transition-all ${
                    isChecked
                      ? 'bg-[#09090b]/80 border-emerald-500/40 text-zinc-100'
                      : 'bg-zinc-950/40 border-zinc-800/60 opacity-60 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const newFlags = [...derivProgressionActiveSteps];
                          newFlags[idx] = e.target.checked;
                          setDerivProgressionActiveSteps(newFlags);
                        }}
                        className="rounded border-zinc-800 text-emerald-500 focus:ring-0 accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className={`text-[11px] font-extrabold uppercase tracking-wide ${isChecked ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        Step {idx + 1}
                      </span>
                    </label>

                    {idx === 0 && (
                      <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md">
                        RESET
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.35"
                      disabled={!isChecked}
                      value={stepVal}
                      onChange={(e) => {
                        const newSteps = [...derivProgressionSteps];
                        newSteps[idx] = e.target.value;
                        setDerivProgressionSteps(newSteps);
                      }}
                      className={`w-full border rounded-xl py-2 px-3 font-mono text-xs focus:outline-none transition-all ${
                        isChecked
                          ? 'bg-[#0c0c0f] border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 text-zinc-100'
                          : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-600 cursor-not-allowed'
                      }`}
                    />
                    <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] font-bold text-zinc-500">
                      USD
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dedicated Save Button */}
          <div className="flex justify-end pt-2 border-t border-zinc-800/50">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-950/40 transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Table...' : 'Save Progression Table'}</span>
            </button>
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
                    <Shield className="w-10 h-10" />
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
                    if (whatsappRecipients.includes(formatted)) return;
                    const updated = [...whatsappRecipients, formatted];
                    setWhatsappRecipients(updated);
                    handleSaveWhatsAppConfig(whatsappEnabled, updated);
                    setNewRecipient('');
                  }}
                  className="px-4 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center"
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
                        className="mt-1 rounded border-zinc-800 bg-[#09090b] text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 w-3.5 h-3.5"
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
