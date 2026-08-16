import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  TrendingUp,
  LayoutDashboard,
  Activity,
  History,
  Settings,
  LogOut,
  User,
  Shield,
  Menu,
  X,
  FileText,
  Beaker,
  Terminal,
} from 'lucide-react';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = getSessionUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch trading mode for dynamic header badge
  const { data: settings } = await supabase
    .from('settings')
    .select('trading_mode')
    .eq('id', 1)
    .single();
  const isReal = settings?.trading_mode === 'REAL';

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex overflow-hidden font-sans">
      {/* Sidebar mobile toggle checkbox (CSS peer trigger) */}
      <input type="checkbox" id="sidebar-toggle" className="hidden peer" />

      {/* Sidebar Mobile Backdrop Overlay */}
      <label htmlFor="sidebar-toggle" className="fixed inset-0 z-25 bg-black/60 backdrop-blur-sm hidden peer-checked:block lg:hidden cursor-pointer" />

      {/* Dynamic Background Gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-zinc-800/80 bg-[#0c0c0f]/95 backdrop-blur-xl flex flex-col justify-between z-30 shrink-0 -translate-x-full transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 peer-checked:translate-x-0">
        <div>
          {/* Sidebar Header with Mobile Close Label */}
          <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-md font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
                  CryptoAI Trader
                </h1>
                <span className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">
                  VIP System v1.0
                </span>
              </div>
            </div>
            
            {/* Mobile close button (HtmlFor sidebar-toggle trigger) */}
            <label
              htmlFor="sidebar-toggle"
              className="lg:hidden p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50 border border-zinc-800/60 rounded-lg cursor-pointer transition-colors flex items-center justify-center"
            >
              <X className="w-4.5 h-4.5" />
            </label>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <LayoutDashboard className="w-5 h-5 text-zinc-400" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/dashboard/scanner"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <Activity className="w-5 h-5 text-zinc-400" />
              <span>Live Scanner</span>
            </Link>

            <Link
              href="/dashboard/signals"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <Shield className="w-5 h-5 text-zinc-400" />
              <span>Signals History</span>
            </Link>

            <Link
              href="/dashboard/trades"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <History className="w-5 h-5 text-zinc-400" />
              <span>Trades History</span>
            </Link>

            <Link
              href="/dashboard/summary"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <FileText className="w-5 h-5 text-zinc-400" />
              <span>Summary Report</span>
            </Link>

            <Link
              href="/dashboard/sandbox"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <Beaker className="w-5 h-5 text-zinc-400" />
              <span>Strategy Sandbox</span>
            </Link>

            <Link
              href="/dashboard/console"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <Terminal className="w-5 h-5 text-zinc-400" />
              <span>System Terminal</span>
            </Link>

            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-zinc-800/50 hover:text-emerald-400 text-zinc-400 transition-all duration-200"
            >
              <Settings className="w-5 h-5 text-zinc-400" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-800/80 space-y-3">
          {/* User profile info */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/40">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-emerald-400 font-bold border border-zinc-700">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-zinc-200 truncate">Saad Ali</p>
              <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>

          {/* Logout Button */}
          <form
            action="/api/auth/logout"
            method="POST"
            className="w-full"
          >
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden z-10">
        {/* Top Header bar */}
        <header className="h-16 border-b border-zinc-800/80 bg-[#0c0c0f]/50 backdrop-blur-xl px-4 lg:px-8 flex items-center justify-between z-20 shrink-0">
          {/* Mobile Menu Burger Trigger */}
          <label htmlFor="sidebar-toggle" className="lg:hidden p-2 text-zinc-400 hover:text-zinc-200 cursor-pointer flex items-center justify-center rounded-xl hover:bg-zinc-800/40 transition-colors">
            <Menu className="w-5 h-5" />
          </label>

          <div className="flex items-center gap-4 ml-auto">
            {/* Dynamic Live Indicator Dot */}
            {isReal ? (
              <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-900/50 rounded-full px-3 py-1 text-xs text-emerald-400 font-semibold shadow-inner shadow-emerald-500/5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE MAINNET</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-950/20 border border-amber-900/50 rounded-full px-3 py-1 text-xs text-amber-500 font-semibold shadow-inner shadow-amber-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>TESTNET LIVE</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
