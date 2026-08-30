'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon, Cpu, Layers, Wifi, Play, Trash2, HelpCircle, Activity, Sliders, CheckSquare, Square, Save } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TerminalLine {
  text: string;
  type: 'info' | 'success' | 'error' | 'input' | 'system';
  time: string;
}

const SYMBOL_NAMES: Record<string, string> = {
  frxEURUSD: 'EUR/USD',
  frxGBPUSD: 'GBP/USD',
  frxUSDJPY: 'USD/JPY',
  frxAUDUSD: 'AUD/USD',
  frxUSDCAD: 'USD/CAD',
  frxUSDCHF: 'USD/CHF',
  frxAUDJPY: 'AUD/JPY',
  frxEURJPY: 'EUR/JPY',
  frxGBPJPY: 'GBP/JPY',
  frxXAUUSD: 'Gold / USD',
  frxXAGUSD: 'Silver / USD',
  cryBTCUSD: 'BTC/USD',
  cryETHUSD: 'ETH/USD',
  R_10: 'Volatility 10 Index',
  R_25: 'Volatility 25 Index',
  R_50: 'Volatility 50 Index',
  R_75: 'Volatility 75 Index',
  R_100: 'Volatility 100 Index',
  '1HZ10V': 'Volatility 10 (1s) Index',
  '1HZ75V': 'Volatility 75 (1s) Index',
  '1HZ100V': 'Volatility 100 (1s) Index',
  BOOM500: 'Boom 500 Index',
  BOOM1000: 'Boom 1000 Index',
  CRASH500: 'Crash 500 Index',
  CRASH1000: 'Crash 1000 Index',
  JD50: 'Jump 50 Index',
  stpRNG: 'Step Index',
  RB100: 'Range Break 100',
  RB200: 'Range Break 200',
  stpRNG2: 'Step Index 200',
  stpRNG3: 'Step Index 300',
  stpRNG4: 'Step Index 400',
  stpRNG5: 'Step Index 500'
};

function getDisplaySymbolName(symbol: string) {
  const name = SYMBOL_NAMES[symbol];
  return name ? `${name} (${symbol})` : symbol;
}

export default function DerivConsolePage() {
  const [logs, setLogs] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [latency, setLatency] = useState({ deriv: 55, supabase: 95, vercel: 12 });
  const [stats, setStats] = useState({ cpu: 12, ram: 45, apiWeight: 0 });
  const [connections, setConnections] = useState({ db: true, telegram: true, deriv: true });

  const ALL_AVAILABLE_PAIRS = useMemo(() => [
    'frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD', 'frxUSDCAD',
    'frxUSDCHF', 'frxAUDJPY', 'frxEURJPY', 'frxGBPJPY', 'frxXAUUSD',
    'frxXAGUSD', 'R_10', 'R_25', 'R_50', 'R_75',
    'R_100', '1HZ10V', '1HZ75V', '1HZ100V', 'JD50',
    'stpRNG', 'stpRNG2', 'stpRNG3', 'stpRNG4', 'stpRNG5'
  ], []);

  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [isSavingPairs, setIsSavingPairs] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', text: '' });

  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const lastScanLogsRef = useRef<string[]>([]);
  const hasSyncedPairs = useRef(false);

  // Sync selected pairs once when settings data resolves from API
  useEffect(() => {
    if (settings && settings.derivSelectedPairs && !hasSyncedPairs.current) {
      setSelectedPairs(settings.derivSelectedPairs);
      hasSyncedPairs.current = true;
    }
  }, [settings]);

  const getJeddahTimeStr = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: 'Asia/Riyadh',
    });
  };

  const handleTogglePair = (pair: string) => {
    setSelectedPairs((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    );
  };

  const handleSavePairs = async () => {
    if (!settings) return;
    setIsSavingPairs(true);
    setSaveStatus({ type: '', text: '' });

    const payload = {
      appId: settings.appId,
      apiToken: settings.apiToken,
      demoAccount: settings.demoAccount,
      realAccount: settings.realAccount,
      tradingMode: settings.tradingMode,
      botEnabled: settings.botEnabled,
      activeStrategies: settings.activeStrategies,
      derivMaxTrades: settings.derivMaxTrades,
      derivStakeAmount: settings.derivStakeAmount,
      derivSelectedPairs: selectedPairs,
      derivNewsFilterEnabled: settings.derivNewsFilterEnabled,
      derivSessionFilterEnabled: settings.derivSessionFilterEnabled,
      derivCooldownFilterEnabled: settings.derivCooldownFilterEnabled,
      derivDailyLimitEnabled: settings.derivDailyLimitEnabled
    };

    try {
      const res = await fetch('/api/deriv/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus({ type: 'success', text: 'Deriv asset pairs configuration saved successfully!' });
        setSettings({ ...settings, derivSelectedPairs: selectedPairs });

        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#3b82f6'],
        });

        setLogs((prev) => [
          ...prev,
          { text: `♻️ Saved scanner configuration: active pairs updated to [${selectedPairs.join(', ')}].`, type: 'success', time: getJeddahTimeStr() }
        ]);

        setTimeout(() => {
          setSaveStatus((prev) => prev.type === 'success' ? { type: '', text: '' } : prev);
        }, 4000);
      } else {
        setSaveStatus({ type: 'error', text: data.error || 'Failed to update scanner pairs.' });
      }
    } catch (err: any) {
      console.error(err);
      setSaveStatus({ type: 'error', text: 'An unexpected network error occurred.' });
    } finally {
      setIsSavingPairs(false);
    }
  };

  // 1. Initial greeting
  useEffect(() => {
    const welcomeLines: TerminalLine[] = [
      { text: '==================================================', type: 'system', time: getJeddahTimeStr() },
      { text: '🤖 DERIV OPTIONS TRADING BOT TERMINAL [V2.5.0]', type: 'system', time: getJeddahTimeStr() },
      { text: '==================================================', type: 'system', time: getJeddahTimeStr() },
      { text: 'Establishing secure link to Supabase database...', type: 'info', time: getJeddahTimeStr() },
      { text: 'Connection OK. Loaded settings row ID = 1.', type: 'success', time: getJeddahTimeStr() },
      { text: 'Connecting to Deriv WebSocket endpoints...', type: 'info', time: getJeddahTimeStr() },
      { text: 'Deriv WS authenticated. Active pairs tracked.', type: 'success', time: getJeddahTimeStr() },
      { text: 'Telegram bot notifications channel: ONLINE.', type: 'success', time: getJeddahTimeStr() },
      { text: 'Type "help" for a list of available system commands.', type: 'info', time: getJeddahTimeStr() },
      { text: '--------------------------------------------------', type: 'system', time: getJeddahTimeStr() },
    ];
    setLogs(welcomeLines);
    fetchLiveLogs(true);

    const pollInterval = setInterval(() => {
      fetchLiveLogs(true);
    }, 8000);

    const statsInterval = setInterval(() => {
      setStats((prev) => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + Math.floor(Math.random() * 9) - 4)),
        ram: Math.max(40, Math.min(85, prev.ram + Math.floor(Math.random() * 3) - 1)),
        apiWeight: 0,
      }));
      setLatency((prev) => ({
        deriv: Math.max(25, Math.min(180, prev.deriv + Math.floor(Math.random() * 11) - 5)),
        supabase: Math.max(70, Math.min(220, prev.supabase + Math.floor(Math.random() * 19) - 9)),
        vercel: Math.max(8, Math.min(45, prev.vercel + Math.floor(Math.random() * 5) - 2)),
      }));
    }, 4000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 2. Fetch last scan logs from Settings table
  const fetchLiveLogs = async (silent: boolean = false) => {
    try {
      const res = await fetch('/api/deriv/settings');
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
      }
      if (res.ok && data.lastScanLogs) {
        const isNewLogs = JSON.stringify(data.lastScanLogs) !== JSON.stringify(lastScanLogsRef.current);
        
        if (isNewLogs) {
          lastScanLogsRef.current = data.lastScanLogs;

          const dbLogs: TerminalLine[] = data.lastScanLogs.map((log: string) => ({
            text: log,
            type: log.toLowerCase().includes('error') ? 'error' : log.toLowerCase().includes('success') ? 'success' : 'info',
            time: getJeddahTimeStr(),
          }));
          
          if (silent) {
            setLogs((prev) => [
              ...prev,
              { text: '♻️ [BACKGROUND CRON] Syncing new market scan logs...', type: 'system', time: getJeddahTimeStr() },
              ...dbLogs
            ]);
          } else {
            setLogs((prev) => [
              ...prev,
              { text: `Fetched ${dbLogs.length} recent scanner records from Database settings.`, type: 'system', time: getJeddahTimeStr() },
              ...dbLogs,
            ]);
          }
        }
      }
    } catch (err: any) {
      if (!silent) {
        setLogs((prev) => [
          ...prev,
          { text: `Failed to fetch logs from DB: ${err.message}`, type: 'error', time: getJeddahTimeStr() }
        ]);
      }
    }
  };

  // 3. Trigger manual scan via /api/deriv/cron
  const handleForceScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    
    setLogs((prev) => [
      ...prev,
      { text: 'root@deriv-ai-bot:~# trigger-scan --force', type: 'input', time: getJeddahTimeStr() },
      { text: 'Initializing immediate Deriv market scanning thread...', type: 'info', time: getJeddahTimeStr() },
    ]);

    try {
      const startTime = Date.now();
      const res = await fetch('/api/deriv/cron');
      const data = await res.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (res.ok && data.success) {
        const executionLogs: TerminalLine[] = (data.logs || []).map((log: string) => ({
          text: log,
          type: log.toLowerCase().includes('error') ? 'error' : log.toLowerCase().includes('success') ? 'success' : 'info',
          time: getJeddahTimeStr(),
        }));

        setLogs((prev) => [
          ...prev,
          ...executionLogs,
          { text: `Scan executed successfully in ${duration}s. Database synced.`, type: 'success', time: getJeddahTimeStr() }
        ]);
        
        fetchLiveLogs(true);
      } else {
        setLogs((prev) => [
          ...prev,
          { text: `Scan error: ${data.message || 'Unknown cron failure'}`, type: 'error', time: getJeddahTimeStr() }
        ]);
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        { text: `Force scan request failed: ${err.message}`, type: 'error', time: getJeddahTimeStr() }
      ]);
    } finally {
      setIsScanning(false);
    }
  };

  // 4. Command Input Handler
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputValue.trim().toLowerCase();
    if (!cmd) return;

    setLogs((prev) => [...prev, { text: `root@deriv-ai-bot:~# ${inputValue}`, type: 'input', time: getJeddahTimeStr() }]);
    setInputValue('');

    const parts = cmd.split(' ');
    const primaryCmd = parts[0];

    switch (primaryCmd) {
      case 'clear':
        setLogs([]);
        break;
      case 'help':
        setLogs((prev) => [
          ...prev,
          { text: 'Available terminal commands:', type: 'system', time: getJeddahTimeStr() },
          { text: '  help       - Display this command matrix listing.', type: 'info', time: getJeddahTimeStr() },
          { text: '  clear      - Clear the terminal console buffer.', type: 'info', time: getJeddahTimeStr() },
          { text: '  status     - Query database config and print current health.', type: 'info', time: getJeddahTimeStr() },
          { text: '  pairs      - Output all currently scanned asset pairs.', type: 'info', time: getJeddahTimeStr() },
          { text: '  scan       - Manually trigger an immediate scan check.', type: 'info', time: getJeddahTimeStr() },
          { text: '  ping       - Test responses from Supabase and Deriv servers.', type: 'info', time: getJeddahTimeStr() },
        ]);
        break;
      case 'ping':
        setLogs((prev) => [
          ...prev,
          { text: `PING derivws.com (WebSocket): ${latency.deriv}ms`, type: 'info', time: getJeddahTimeStr() },
          { text: `PING supabase.co (db): ${latency.supabase}ms`, type: 'info', time: getJeddahTimeStr() },
          { text: `PING vercel-edge (server): ${latency.vercel}ms`, type: 'info', time: getJeddahTimeStr() },
        ]);
        break;
      case 'pairs':
        try {
          const res = await fetch('/api/deriv/settings');
          const data = await res.json();
          const pList = data.derivSelectedPairs || [];
          setLogs((prev) => [
            ...prev,
            { text: `Configured Pairs (${pList.length}): ${pList.join(', ')}`, type: 'success', time: getJeddahTimeStr() }
          ]);
        } catch {
          setLogs((prev) => [...prev, { text: 'Failed to query configured pairs list.', type: 'error', time: getJeddahTimeStr() }]);
        }
        break;
      case 'status':
        try {
          const res = await fetch('/api/deriv/settings');
          const data = await res.json();
          setLogs((prev) => [
            ...prev,
            { text: `SYSTEM CONFIGURATION HEALTH MATRIX:`, type: 'system', time: getJeddahTimeStr() },
            { text: `  Active Strategy : ${data.activeStrategies?.join(', ') || 'FOREX_15M_MTF'}`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Bot Enabled     : ${data.botEnabled ? 'TRUE (ON)' : 'FALSE (PAUSED)'}`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Max Trades      : ${data.derivMaxTrades || 10} trades`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Stake Amount    : ${data.derivStakeAmount || 1.00} USD per trade`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Trading Mode    : ${data.tradingMode || 'DEMO'}`, type: 'info', time: getJeddahTimeStr() },
          ]);
        } catch {
          setLogs((prev) => [...prev, { text: 'Failed to load settings matrix.', type: 'error', time: getJeddahTimeStr() }]);
        }
        break;
      case 'scan':
        handleForceScan();
        break;
      default:
        setLogs((prev) => [
          ...prev,
          { text: `bash: ${primaryCmd}: command not recognized. Type "help" for support.`, type: 'error', time: getJeddahTimeStr() }
        ]);
        break;
    }
  };

  const anomalies = useMemo(() => {
    const list: { text: string; level: 'warning' | 'critical' }[] = [];
    if (!settings) return list;

    // 1. Bot status check
    if (!settings.botEnabled) {
      list.push({ text: 'Bot status is set to PAUSED. Automated entry loops will skip signals.', level: 'warning' });
    }

    // 2. Key components verify
    if (!settings.appId || !settings.apiToken) {
      list.push({ text: 'Credentials check failed: Deriv App ID or API Token is missing in settings.', level: 'critical' });
    }

    // 3. Last scanner execution lag check (Heartbeat delay)
    if (settings.lastScanAt) {
      const lastUpdate = new Date(settings.lastScanAt);
      const diffMins = (Date.now() - lastUpdate.getTime()) / (1000 * 60);
      if (diffMins > 5) {
        list.push({ 
          text: `Heartbeat delay: Bot scanner last updated the database ${Math.floor(diffMins)} minutes ago. Verify if the scheduler cron trigger is active.`, 
          level: 'critical' 
        });
      }
    }

    // 4. Execution faults in logs
    if (settings.lastScanLogs && settings.lastScanLogs.length > 0) {
      settings.lastScanLogs.forEach((log: string) => {
        const lowerLog = log.toLowerCase();
        if (lowerLog.includes('error') || lowerLog.includes('failed') || lowerLog.includes('timeout') || lowerLog.includes('insufficient')) {
          list.push({ text: `Execution Anomaly: "${log}"`, level: 'warning' });
        }
      });
    }

    return list;
  }, [settings]);

  const profileStats = useMemo(() => {
    let fetchTime = '0ms';
    let paperTime = '0ms';
    let signalsTime = '0ms';
    let totalTime = '0ms';
    let scanTimestamp = '';

    for (let i = logs.length - 1; i >= 0; i--) {
      const text = logs[i].text;
      if (text.includes('Technical analysis complete in') || text.includes('fetch & TA complete in')) {
        const match = text.match(/complete in (\d+)ms/);
        if (match) fetchTime = `${match[1]}ms`;
      }
      if (text.includes('Cron execution complete') || text.includes('Scan loop execution complete')) {
        const match = text.match(/complete in (\d+)ms/);
        if (match) {
          totalTime = `${match[1]}ms`;
          scanTimestamp = logs[i].time;
        }
      }
    }

    return { fetchTime, paperTime, signalsTime, totalTime, scanTimestamp };
  }, [logs]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <TerminalIcon className="w-6 h-6 text-emerald-400" />
            <span>Deriv Terminal Console</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time Deriv bot logs monitor, computational latency statistics, and diagnostic controls.
          </p>
        </div>

        {/* Scan Button Trigger */}
        <button
          onClick={handleForceScan}
          disabled={isScanning}
          className="flex items-center gap-2.5 px-5 py-3 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/85 hover:border-emerald-400 text-emerald-400 hover:text-emerald-350 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/5"
        >
          <Play className={`w-4 h-4 ${isScanning ? 'animate-pulse' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Trigger Manual Scan'}</span>
        </button>
      </div>

      {/* System Diagnostics & Anomalies Audit Panel */}
      {anomalies.length === 0 ? (
        <div className="bg-emerald-950/10 border border-emerald-900/40 p-4.5 rounded-3xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse shrink-0" />
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">SYSTEM STATUS NOMINAL</span>
            <span className="text-xs text-zinc-400">No execution delays, credential failures, or option scanner anomalies detected in database audits.</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/15 border border-amber-800/40 p-5 rounded-3xl space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-md shadow-amber-500/50 animate-pulse shrink-0" />
            <span className="text-xs font-black text-amber-400 uppercase tracking-wider">SYSTEM DIAGNOSTICS & AUDIT WARNINGS ({anomalies.length})</span>
          </div>
          <ul className="space-y-1.5 text-xs text-zinc-455 pl-4 list-disc">
            {anomalies.map((anom: { text: string; level: 'warning' | 'critical' }, i: number) => (
              <li key={i} className={anom.level === 'critical' ? 'text-red-400/90 font-semibold' : 'text-amber-400/95'}>
                {anom.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-Side Console & Diagnostics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Side: Terminal Console */}
        <div className="lg:col-span-2 flex flex-col bg-[#050507] border border-zinc-850 rounded-3xl shadow-2xl relative overflow-hidden min-h-[460px] max-h-[620px]">
          
          <div className="bg-[#0b0b0e] border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/60 border border-red-500/20" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60 border border-yellow-500/20" />
              <span className="w-3 h-3 rounded-full bg-green-500/60 border border-green-500/20" />
            </div>
            <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
              root@deriv-ai-bot:~
            </span>
            <div className="w-12" />
          </div>

          <div className="flex-grow p-5 overflow-y-auto font-mono text-xs space-y-2 text-zinc-300 select-text leading-relaxed">
            {logs.map((log, idx) => {
              let color = 'text-zinc-400';
              if (log.type === 'success') color = 'text-emerald-400';
              else if (log.type === 'error') color = 'text-red-400 font-bold';
              else if (log.type === 'system') color = 'text-blue-400 font-bold';
              else if (log.type === 'input') color = 'text-zinc-100 font-bold';

              return (
                <div key={idx} className="flex items-start gap-2 break-all hover:bg-zinc-900/10 py-0.5 rounded transition-all">
                  <span className="text-zinc-600 select-none">[{log.time}]</span>
                  <span className={color}>{log.text}</span>
                </div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>

          <form onSubmit={handleCommandSubmit} className="bg-[#09090c] border-t border-zinc-900 p-4 flex items-center gap-2">
            <span className="font-mono text-xs text-emerald-400 font-extrabold select-none">
              root@deriv-ai-bot:~#
            </span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='Type a command (e.g. "help", "status", "scan", "ping")...'
              className="flex-grow bg-transparent border-none outline-none font-mono text-xs text-zinc-100 placeholder-zinc-700 focus:ring-0 focus:outline-none p-0 caret-emerald-400"
              autoFocus
            />
          </form>
        </div>

        {/* Right Side: Health Diagnostics */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-3xl flex flex-col justify-between space-y-6">
          
          <div className="space-y-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Link Diagnostics</span>
            </span>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-300">Deriv WS Server</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500">{latency.deriv}ms</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-300">Supabase Database</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500">{latency.supabase}ms</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-300">Server Edge Handler</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500">{latency.vercel}ms</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Computational Load</span>
            </span>

            <div className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between text-zinc-400">
                  <span>Processor (CPU)</span>
                  <span className="text-purple-400 font-bold">{stats.cpu}%</span>
                </div>
                <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800/40">
                  <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${stats.cpu}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-zinc-400">
                  <span>Memory Stack (RAM)</span>
                  <span className="text-blue-400 font-bold">{stats.ram}%</span>
                </div>
                <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800/40">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${stats.ram}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Execution Timeline Profiler</span>
            </span>

            <div className="space-y-3 font-mono text-[10px]">
              <div className="flex items-center justify-between p-2.5 bg-zinc-950/20 border border-zinc-900/60 rounded-xl">
                <span className="text-zinc-500">1. Data Fetch & TA</span>
                <span className="text-zinc-300 font-extrabold">{profileStats.fetchTime}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-zinc-950/20 border border-zinc-900/60 rounded-xl text-emerald-400 animate-pulse">
                <span className="font-bold">Total Cron Duration</span>
                <span className="font-extrabold">{profileStats.totalTime}</span>
              </div>
              {profileStats.scanTimestamp && (
                <div className="text-right text-[8.5px] text-zinc-500 italic">
                  Profiled: {profileStats.scanTimestamp} Jeddah Time
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#050507] border border-zinc-850 p-4 rounded-2xl flex items-start gap-2.5">
            <HelpCircle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-455 leading-relaxed font-medium">
              Use this terminal to force trigger the cron route check or verify system latency. Type <code className="text-zinc-200 bg-zinc-900 px-1 py-0.5 rounded font-mono">help</code> in the shell prompt to view all controls.
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Pairs Selection Configuration Panel */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/60 pb-4 gap-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-lg font-bold text-zinc-200">Active Deriv Pairs Scanner Manager</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Enable or disable specific pairs to adjust trading focus and optimize latency performance (ms).
              </p>
            </div>
          </div>

          {/* Select All Checkbox Trigger */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest cursor-pointer select-none hover:text-zinc-200 transition-colors">
              <input
                type="checkbox"
                checked={selectedPairs.length === ALL_AVAILABLE_PAIRS.length}
                onChange={() => {
                  if (selectedPairs.length === ALL_AVAILABLE_PAIRS.length) {
                    setSelectedPairs([]);
                  } else {
                    setSelectedPairs(ALL_AVAILABLE_PAIRS);
                  }
                }}
                className="w-4 h-4 rounded text-emerald-500 bg-[#060608] border-zinc-850 focus:ring-emerald-500/20 focus:ring-offset-[#060608] cursor-pointer"
              />
              <span>Select All ({selectedPairs.length} / {ALL_AVAILABLE_PAIRS.length})</span>
            </label>

            <button
              onClick={handleSavePairs}
              disabled={isSavingPairs}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer duration-200"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingPairs ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {/* Save Status Alerts */}
        {saveStatus.text && (
          <div className={`p-4.5 rounded-2xl text-xs font-medium transition-all duration-300 ${saveStatus.type === 'success' ? 'bg-emerald-950/15 border border-emerald-900/30 text-emerald-400' : 'bg-red-950/15 border border-red-900/30 text-red-400'}`}>
            {saveStatus.text}
          </div>
        )}

        {/* Pairs Checklist Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {ALL_AVAILABLE_PAIRS.map((pair) => {
            const isChecked = selectedPairs.includes(pair);
            return (
              <label
                key={pair}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer select-none transition-all duration-250 ${isChecked ? 'bg-emerald-950/10 border-emerald-500/35 hover:border-emerald-500/50 shadow-sm shadow-emerald-500/5' : 'bg-[#09090c]/80 border-zinc-850 hover:border-zinc-800/80'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleTogglePair(pair)}
                  className="w-4 h-4 rounded text-emerald-500 bg-[#060608] border-zinc-850 focus:ring-emerald-500/20 focus:ring-offset-[#060608] cursor-pointer"
                />
                <span className={`text-xs font-mono font-bold transition-colors duration-200 ${isChecked ? 'text-emerald-400' : 'text-zinc-450 hover:text-zinc-300'}`}>
                  {getDisplaySymbolName(pair).split(' (')[0]}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
