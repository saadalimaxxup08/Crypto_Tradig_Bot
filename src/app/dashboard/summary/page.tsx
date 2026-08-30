'use client';

import Link from 'next/link';
import { FileText, ArrowRight, TrendingUp, LineChart, Shield, HelpCircle } from 'lucide-react';

export default function ReportCenterPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Header Banner */}
      <div className="bg-[#0c0c0f]/40 backdrop-blur-md border border-zinc-800/80 p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full bg-blue-500/5 blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Trading Diagnostics</span>
          <h2 className="text-3xl font-extrabold tracking-tight">VIP Performance Report Center</h2>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Select a market category below to analyze trading performance statistics, download verified PDF ledger sheets, or dispatch performance reports directly to Telegram.
          </p>
        </div>
      </div>

      {/* Main Grid: Two Big Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Card 1: Binance Futures */}
        <Link 
          href="/dashboard/summary/binance"
          className="group flex flex-col justify-between bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800 hover:border-blue-500/50 p-8 rounded-3xl shadow-xl transition-all duration-300 hover:shadow-blue-500/5 hover:-translate-y-1 select-none cursor-pointer"
        >
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-950/20 border border-blue-900/40 flex items-center justify-center text-blue-400 transition-all duration-300 group-hover:bg-blue-500 group-hover:text-zinc-950 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-blue-500/20">
              <TrendingUp className="w-7 h-7" />
            </div>
            
            <div className="space-y-2.5">
              <h3 className="text-xl font-extrabold text-zinc-200 group-hover:text-white transition-colors">
                Binance Futures Summary
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Detailed analysis of leverage perpetual contracts trading, net realized P&L margins, win rate distribution, and overall coin execution ledger.
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-blue-400 group-hover:text-blue-300 border-t border-zinc-850 pt-4 transition-colors">
            <span>Open Binance Report</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
          </div>
        </Link>

        {/* Card 2: Deriv Options */}
        <Link 
          href="/dashboard/deriv/summary"
          className="group flex flex-col justify-between bg-[#0c0c0f]/60 backdrop-blur-xl border border-zinc-800 hover:border-emerald-500/50 p-8 rounded-3xl shadow-xl transition-all duration-300 hover:shadow-emerald-500/5 hover:-translate-y-1 select-none cursor-pointer"
        >
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-center text-emerald-400 transition-all duration-300 group-hover:bg-emerald-500 group-hover:text-zinc-950 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-emerald-500/20">
              <LineChart className="w-7 h-7" />
            </div>
            
            <div className="space-y-2.5">
              <h3 className="text-xl font-extrabold text-zinc-200 group-hover:text-white transition-colors">
                Deriv Options Summary
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Performance overview of Rise/Fall binary options contracts, win/loss rate speeds, stake sizes, and synthetic index settlement ledger.
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-400 group-hover:text-emerald-300 border-t border-zinc-850 pt-4 transition-colors">
            <span>Open Deriv Report</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
          </div>
        </Link>

      </div>

      {/* Helper Context Info */}
      <div className="bg-[#0c0c0f]/20 border border-zinc-850 p-5 rounded-2xl flex items-start gap-3.5 max-w-2xl mx-auto">
        <HelpCircle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
          Both report centers operate under Jeddah Time (GMT+3) audit intervals and offer direct PDF compiles. Ensure Telegram bot credentials are active in Settings to use the instant broadcast feature.
        </p>
      </div>
    </div>
  );
}
