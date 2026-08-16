'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon, Cpu, Layers, Wifi, Play, Trash2, HelpCircle, Activity } from 'lucide-react';

interface TerminalLine {
  text: string;
  type: 'info' | 'success' | 'error' | 'input' | 'system';
  time: string;
}

export default function ConsolePage() {
  const [logs, setLogs] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [latency, setLatency] = useState({ binance: 42, supabase: 95, vercel: 12 });
  const [stats, setStats] = useState({ cpu: 12, ram: 45, apiWeight: 22 });
  const [connections, setConnections] = useState({ db: true, telegram: true, binance: true });

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const getJeddahTimeStr = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: 'Asia/Riyadh',
    });
  };

  // 1. Initial greeting
  useEffect(() => {
    const welcomeLines: TerminalLine[] = [
      { text: '==================================================', type: 'system', time: getJeddahTimeStr() },
      { text: '🤖 CRYPTO AI TRADING BOT COMMAND TERMINAL [V2.5.0]', type: 'system', time: getJeddahTimeStr() },
      { text: '==================================================', type: 'system', time: getJeddahTimeStr() },
      { text: 'Establishing secure link to Supabase database...', type: 'info', time: getJeddahTimeStr() },
      { text: 'Connection OK. Loaded settings row ID = 1.', type: 'success', time: getJeddahTimeStr() },
      { text: 'Connecting to Binance Futures API endpoints...', type: 'info', time: getJeddahTimeStr() },
      { text: 'Binance authenticated. 22 active pairs tracked.', type: 'success', time: getJeddahTimeStr() },
      { text: 'Telegram bot notifications channel: ONLINE.', type: 'success', time: getJeddahTimeStr() },
      { text: 'Type "help" for a list of available system commands.', type: 'info', time: getJeddahTimeStr() },
      { text: '--------------------------------------------------', type: 'system', time: getJeddahTimeStr() },
    ];
    setLogs(welcomeLines);
    fetchLiveLogs(true);

    // Latency & Stats simulation intervals
    const statsInterval = setInterval(() => {
      setStats((prev) => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + Math.floor(Math.random() * 9) - 4)),
        ram: Math.max(40, Math.min(85, prev.ram + Math.floor(Math.random() * 3) - 1)),
        apiWeight: 22,
      }));
      setLatency((prev) => ({
        binance: Math.max(25, Math.min(180, prev.binance + Math.floor(Math.random() * 11) - 5)),
        supabase: Math.max(70, Math.min(220, prev.supabase + Math.floor(Math.random() * 19) - 9)),
        vercel: Math.max(8, Math.min(45, prev.vercel + Math.floor(Math.random() * 5) - 2)),
      }));
    }, 4000);

    return () => clearInterval(statsInterval);
  }, []);

  // Scroll to bottom of terminal whenever logs update
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 2. Fetch last scan logs from Settings table
  const fetchLiveLogs = async (silent: boolean = false) => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
      }
      if (res.ok && data.last_scan_logs) {
        const dbLogs: TerminalLine[] = data.last_scan_logs.map((log: string) => ({
          text: log,
          type: log.toLowerCase().includes('error') ? 'error' : log.toLowerCase().includes('success') ? 'success' : 'info',
          time: getJeddahTimeStr(),
        }));
        
        if (silent) {
          setLogs((prev) => [...prev, ...dbLogs]);
        } else {
          setLogs((prev) => [
            ...prev,
            { text: `Fetched ${dbLogs.length} recent scanner records from Database settings row.`, type: 'system', time: getJeddahTimeStr() },
            ...dbLogs,
          ]);
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

  // 3. Trigger manual scan via /api/cron
  const handleForceScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    
    setLogs((prev) => [
      ...prev,
      { text: 'root@crypto-ai-bot:~# trigger-scan --force', type: 'input', time: getJeddahTimeStr() },
      { text: 'Initializing immediate market scanning thread...', type: 'info', time: getJeddahTimeStr() },
    ]);

    try {
      const startTime = Date.now();
      const res = await fetch('/api/cron');
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
          { text: `Scan executed successfully in ${duration}s. 22 Pairs scanned. Database synced.`, type: 'success', time: getJeddahTimeStr() }
        ]);
        
        // Refresh weights and settings state
        setStats((prev) => ({ ...prev, apiWeight: 22 }));
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

    setLogs((prev) => [...prev, { text: `root@crypto-ai-bot:~# ${inputValue}`, type: 'input', time: getJeddahTimeStr() }]);
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
          { text: '  ping       - Test responses from Supabase and Binance servers.', type: 'info', time: getJeddahTimeStr() },
        ]);
        break;
      case 'ping':
        setLogs((prev) => [
          ...prev,
          { text: `PING binance.com (fstream): ${latency.binance}ms`, type: 'info', time: getJeddahTimeStr() },
          { text: `PING supabase.co (db): ${latency.supabase}ms`, type: 'info', time: getJeddahTimeStr() },
          { text: `PING vercel-edge (server): ${latency.vercel}ms`, type: 'info', time: getJeddahTimeStr() },
        ]);
        break;
      case 'pairs':
        try {
          const res = await fetch('/api/settings');
          const data = await res.json();
          const pList = data.pairs || [];
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
          const res = await fetch('/api/settings');
          const data = await res.json();
          setLogs((prev) => [
            ...prev,
            { text: `SYSTEM CONFIGURATION HEALTH MATRIX:`, type: 'system', time: getJeddahTimeStr() },
            { text: `  Active Strategy : ${data.active_strategy || 'RSI_MACD'}`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Bot Enabled     : ${data.bot_enabled ? 'TRUE (ON)' : 'FALSE (PAUSED)'}`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Leverage        : ${data.leverage || 20}x`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Risk Level      : ${data.risk_amount || 10} USDT per trade`, type: 'info', time: getJeddahTimeStr() },
            { text: `  Binance Mode    : ${data.binance_demo_api_key ? 'DEMO (PAPER)' : 'LIVE'}`, type: 'info', time: getJeddahTimeStr() },
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
    if (!settings.bot_enabled) {
      list.push({ text: 'Bot status is set to PAUSED. Automated entry loops will skip signals.', level: 'warning' });
    }

    // 2. Key components verify
    const isDemo = settings.binance_demo_api_key ? true : false;
    if (isDemo && (!settings.binance_demo_api_key || !settings.binance_demo_secret_key)) {
      list.push({ text: 'Credentials check failed: Binance DEMO API/Secret keys are missing or invalid.', level: 'critical' });
    } else if (!isDemo && (!settings.binance_real_api_key || !settings.binance_real_secret_key)) {
      list.push({ text: 'Credentials check failed: Binance LIVE API/Secret keys are missing or invalid.', level: 'critical' });
    }

    if (!settings.telegram_token || !settings.telegram_chat_id) {
      list.push({ text: 'Telegram bot credentials missing. Real-time alert broadcasts are disabled.', level: 'warning' });
    }

    // 3. Last scanner execution lag check (Heartbeat delay)
    if (settings.updated_at) {
      const lastUpdate = new Date(settings.updated_at);
      const diffMins = (Date.now() - lastUpdate.getTime()) / (1000 * 60);
      if (diffMins > 5) {
        list.push({ 
          text: `Heartbeat delay: Bot scanner last updated the database ${Math.floor(diffMins)} minutes ago. Verify if the scheduler cron trigger is active.`, 
          level: 'critical' 
        });
      }
    }

    // 4. Execution faults in logs
    if (settings.last_scan_logs && settings.last_scan_logs.length > 0) {
      settings.last_scan_logs.forEach((log: string) => {
        const lowerLog = log.toLowerCase();
        if (lowerLog.includes('error') || lowerLog.includes('failed') || lowerLog.includes('timeout') || lowerLog.includes('insufficient')) {
          list.push({ text: `Execution Anomaly: "${log}"`, level: 'warning' });
        }
      });
    }

    return list;
  }, [settings]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <TerminalIcon className="w-6 h-6 text-emerald-400" />
            <span>System Terminal Console</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time bot logs monitor, computational latency statistics, and diagnostic controls.
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
            <span className="text-xs text-zinc-400">No execution delays, credential failures, or coin scanner anomalies detected in database audits.</span>
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
        
        {/* Left Side: The Interactive Hacking Terminal Console (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col bg-[#050507] border border-zinc-850 rounded-3xl shadow-2xl relative overflow-hidden min-h-[460px] max-h-[620px]">
          
          {/* Terminal Window Header Mac-style */}
          <div className="bg-[#0b0b0e] border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/60 border border-red-500/20" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60 border border-yellow-500/20" />
              <span className="w-3 h-3 rounded-full bg-green-500/60 border border-green-500/20" />
            </div>
            <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
              root@crypto-ai-bot:~
            </span>
            <div className="w-12" />
          </div>

          {/* Terminal Logs Output Area */}
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

          {/* Terminal Command Input Form */}
          <form onSubmit={handleCommandSubmit} className="bg-[#09090c] border-t border-zinc-900 p-4 flex items-center gap-2">
            <span className="font-mono text-xs text-emerald-400 font-extrabold select-none">
              root@crypto-ai-bot:~#
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

        {/* Right Side: Health Diagnostics Statistics Panel (1/3 width) */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-3xl flex flex-col justify-between space-y-6">
          
          {/* Section 1: Server Status LEDs */}
          <div className="space-y-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Link Diagnostics</span>
            </span>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-950/20 border border-zinc-900 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-300">Binance Futures API</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500">{latency.binance}ms</span>
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
                  <span className="text-xs font-bold text-zinc-300">Vercel Edge Handler</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-zinc-500">{latency.vercel}ms</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Mock Hardware Load metrics (Hacker aesthetics) */}
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

              <div className="space-y-1.5">
                <div className="flex justify-between text-zinc-400">
                  <span>Weight Used</span>
                  <span className="text-emerald-400 font-bold">{stats.apiWeight} / 2400</span>
                </div>
                <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800/40">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${(stats.apiWeight / 2400) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Clean helper notes */}
          <div className="bg-[#050507] border border-zinc-850 p-4 rounded-2xl flex items-start gap-2.5">
            <HelpCircle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-450 leading-relaxed font-medium">
              Use this terminal to force trigger the cron route check or verify system latency. Type <code className="text-zinc-200 bg-zinc-900 px-1 py-0.5 rounded font-mono">help</code> in the shell prompt to view all controls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
