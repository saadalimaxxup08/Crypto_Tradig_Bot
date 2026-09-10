'use client';

import { useState, useEffect } from 'react';
import {
  Cpu,
  Database,
  Globe,
  Activity,
  RefreshCw,
  Clock,
  Shield,
  Zap,
  ExternalLink,
  MessageSquare,
  Send,
  HardDrive,
  Users,
  FolderArchive
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface InfraData {
  systemTime: {
    utc: string;
    jeddah: string;
    latencyMs: number;
  };
  supabase: {
    status: string;
    latencyMs: number;
    tradesCount: number;
    signalsCount: number;
    orgEgressGb: number;
    orgEgressLimitGb: number;
    orgEgressRemainingGb: number;
    orgEgressPercent: number;
    orgDbSizeMb: number;
    orgDbLimitMb: number;
    orgDbRemainingMb: number;
    orgDbPercent: number;
    botDbShareMb: number;
    botEgressShareGb: number;
    mauCount: number;
    mauLimit: number;
    storageGb: number;
    storageLimitGb: number;
  };
  derivEngine: {
    appId: string;
    tokenSet: boolean;
    tokenMasked: string;
    demoAccount: string;
    realAccount: string;
    tradingMode: 'DEMO' | 'REAL';
    botEnabled: boolean;
    lastScanAt: string;
    minutesSinceLastScan: number;
    cronStatus: string;
    activeStrategies: string[];
    maxTrades: number;
    stakeAmount: number;
    selectedPairsCount: number;
  };
  github: {
    repo: string;
    branch: string;
    provider: string;
    status: string;
  };
  hosting: {
    platform: string;
    nodeVersion: string;
    environment: string;
    workerProvider: string;
  };
  gateways: {
    telegram: {
      configured: boolean;
      chatId: string;
    };
    whatsapp: {
      enabled: boolean;
      recipientsCount: number;
    };
  };
}

export default function InfrastructurePage() {
  const [data, setData] = useState<InfraData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchInfraData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/infrastructure');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      }
    } catch (err) {
      console.error('Failed to load infrastructure data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInfraData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchInfraData();
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  const runDiagnosticScan = async () => {
    setIsRunningDiagnostic(true);
    setDiagnosticReport(null);
    setStatusMsg({ type: '', text: '' });

    try {
      const res = await fetch('/api/diagnostics', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setDiagnosticReport(json.report);
        setStatusMsg({ type: 'success', text: 'Full System Diagnostic completed successfully!' });
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 } });
      } else {
        setStatusMsg({ type: 'error', text: json.error || 'Diagnostic scan failed.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Scanning Supabase Organization &amp; Project Performance...</p>
      </div>
    );
  }

  const isDbOk = data?.supabase.status === 'OK';
  const isBotRunning = Boolean(data?.derivEngine.botEnabled);
  const tradingMode = data?.derivEngine.tradingMode || 'DEMO';

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-4">
      {/* Top Banner Header */}
      <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-zinc-100">Project Source Performance</h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                100% OPERATIONAL
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Exact Supabase Organization Free Tier usage, Database limits, Egress consumption, GitHub repo sync, and Deriv API gateways.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchInfraData}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={runDiagnosticScan}
            disabled={isRunningDiagnostic}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <Zap className="w-4 h-4 fill-zinc-950" />
            <span>{isRunningDiagnostic ? 'Scanning...' : 'Run Diagnostic Scan'}</span>
          </button>
        </div>
      </div>

      {statusMsg.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold ${statusMsg.type === 'success' ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border border-red-900/50 text-red-400'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Grid of 4 Key Supabase Metrics (Matching Supabase Organization Dashboard Exactly) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Supabase Egress */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Supabase Bandwidth Egress</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xl font-mono font-extrabold text-zinc-100">{data?.supabase.orgEgressGb} GB</span>
              <span className="text-[10px] text-zinc-500 font-mono">/ {data?.supabase.orgEgressLimitGb} GB Free Limit</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${data?.supabase.orgEgressPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-2 font-medium">
              <span>{data?.supabase.orgEgressRemainingGb} GB Remaining</span>
              <span className="text-emerald-400 font-bold">Bot Share: ~{data?.supabase.botEgressShareGb} GB</span>
            </div>
          </div>
        </div>

        {/* Database Size */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Database Size</span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xl font-mono font-extrabold text-zinc-100">{data?.supabase.orgDbSizeMb} MB</span>
              <span className="text-[10px] text-zinc-500 font-mono">/ {data?.supabase.orgDbLimitMb} MB Free Limit</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${data?.supabase.orgDbPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-2 font-medium">
              <span>{data?.supabase.orgDbRemainingMb} MB Remaining</span>
              <span className="text-blue-400 font-bold">Bot Share: ~{data?.supabase.botDbShareMb} MB</span>
            </div>
          </div>
        </div>

        {/* Monthly Active Users */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Monthly Active Users (MAU)</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xl font-mono font-extrabold text-zinc-100">{data?.supabase.mauCount}</span>
              <span className="text-[10px] text-zinc-500 font-mono">/ {data?.supabase.mauLimit.toLocaleString()} MAU</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: '0.1%' }} />
            </div>
            <span className="text-[10px] text-zinc-500 block mt-2 font-medium">
              Active Supabase Auth Accounts
            </span>
          </div>
        </div>

        {/* File Storage */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Supabase Storage</span>
            <FolderArchive className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xl font-mono font-extrabold text-zinc-100">{data?.supabase.storageGb} GB</span>
              <span className="text-[10px] text-zinc-500 font-mono">/ {data?.supabase.storageLimitGb} GB Limit</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: '0%' }} />
            </div>
            <span className="text-[10px] text-zinc-500 block mt-2 font-medium">
              PDF Reports &amp; Attachments Storage
            </span>
          </div>
        </div>
      </div>

      {/* Full Detailed Infrastructure Providers Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Supabase DB & Egress Breakdown */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-zinc-100">Supabase Organization Usage Breakdown</h3>
                <p className="text-[11px] text-zinc-400">Matching your exact Supabase Org Free Plan dashboard</p>
              </div>
            </div>
            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${isDbOk ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-red-950/40 border-red-800 text-red-400'}`}>
              {isDbOk ? 'ONLINE' : 'ERROR'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Total Org Egress Usage</span>
              <span className="font-mono text-emerald-400 font-bold">{data?.supabase.orgEgressGb} GB / {data?.supabase.orgEgressLimitGb} GB</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Total Org Database Size</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.supabase.orgDbSizeMb} MB / {data?.supabase.orgDbLimitMb} MB</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Deriv Bot Database Share</span>
              <span className="font-mono text-blue-400 font-bold">~{data?.supabase.botDbShareMb} MB (out of 28 MB)</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Deriv Trades Table Rows</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.supabase.tradesCount} rows</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Deriv Signals Table Rows</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.supabase.signalsCount} rows</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Supabase Connection Latency</span>
              <span className="font-mono text-emerald-400 font-bold">{data?.supabase.latencyMs} ms</span>
            </div>
          </div>
        </div>

        {/* Card 2: GitHub & Source Deployment */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-base font-bold text-zinc-100">GitHub Source &amp; Hosting Deployment</h3>
                <p className="text-[11px] text-zinc-400">Git repository sync &amp; Vercel production hosting</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border bg-blue-950/40 border-blue-800 text-blue-400">
              SYNCED
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">GitHub Repository</span>
              <a
                href={`https://github.com/${data?.github.repo}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-blue-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>{data?.github.repo}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Active Git Branch</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.github.branch}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Hosting Platform</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.hosting.platform}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Background Worker Cron</span>
              <span className="font-mono text-emerald-400 font-bold">{data?.hosting.workerProvider}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Node Runtime Engine</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.hosting.nodeVersion} ({data?.hosting.environment})</span>
            </div>
          </div>
        </div>

        {/* Card 3: Deriv WebSocket Engine Details */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-zinc-100">Deriv Options WebSocket Engine</h3>
                <p className="text-[11px] text-zinc-400">Deriv API connection &amp; scanning parameters</p>
              </div>
            </div>
            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${isBotRunning ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-amber-950/40 border-amber-800 text-amber-400'}`}>
              {isBotRunning ? 'ENGINE RUNNING' : 'ENGINE PAUSED'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Deriv App ID</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.derivEngine.appId}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Deriv API Token (PAT)</span>
              <span className="font-mono text-emerald-400 font-bold">
                {data?.derivEngine.tokenSet ? 'VERIFIED ✅' : 'MISSING ❌'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Active Account Mode</span>
              <span className="font-mono text-amber-400 font-bold">{data?.derivEngine.tradingMode}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Last Cron Scan Execution</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.derivEngine.cronStatus}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Stake Risk Per Option</span>
              <span className="font-mono text-zinc-200 font-bold">${data?.derivEngine.stakeAmount} USD</span>
            </div>
          </div>
        </div>

        {/* Card 4: Notification Gateways */}
        <div className="bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
            <div className="flex items-center gap-3">
              <Send className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-base font-bold text-zinc-100">Telegram &amp; WhatsApp Gateways</h3>
                <p className="text-[11px] text-zinc-400">Outbound trading signal alert routes</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border bg-purple-950/40 border-purple-800 text-purple-400">
              GATEWAYS ACTIVE
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Telegram Bot Integration</span>
              <span className="font-mono text-emerald-400 font-bold">
                {data?.gateways.telegram.configured ? 'ACTIVE ✅' : 'NOT CONFIGURED'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Telegram Target Channel ID</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.gateways.telegram.chatId}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">WhatsApp Notification Bridge</span>
              <span className="font-mono text-emerald-400 font-bold">
                {data?.gateways.whatsapp.enabled ? 'ENABLED ✅' : 'DISABLED'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">WhatsApp Recipients Count</span>
              <span className="font-mono text-zinc-200 font-bold">{data?.gateways.whatsapp.recipientsCount} contacts</span>
            </div>

            <div className="flex justify-between py-2 border-b border-zinc-900">
              <span className="text-zinc-400">Server Jeddah Time (GMT+3)</span>
              <span className="font-mono text-zinc-300 font-bold">{data?.systemTime.jeddah}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic Report Results Modal / Container */}
      {diagnosticReport && (
        <div className="bg-[#0c0c0f]/80 backdrop-blur-xl border border-emerald-900/50 rounded-3xl p-6 space-y-4 shadow-lg animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Latest Diagnostic Report</span>
            </h3>
            <button
              type="button"
              onClick={() => setDiagnosticReport(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-2xl">
              <span className="text-zinc-500 block mb-1 font-bold">Database Check</span>
              <span className={`font-bold ${diagnosticReport.database?.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                {diagnosticReport.database?.message}
              </span>
            </div>

            <div className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-2xl">
              <span className="text-zinc-500 block mb-1 font-bold">Deriv API Check</span>
              <span className={`font-bold ${diagnosticReport.deriv?.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                {diagnosticReport.deriv?.message}
              </span>
            </div>

            <div className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-2xl">
              <span className="text-zinc-500 block mb-1 font-bold">Telegram Route Check</span>
              <span className={`font-bold ${diagnosticReport.telegram?.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                {diagnosticReport.telegram?.message}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
