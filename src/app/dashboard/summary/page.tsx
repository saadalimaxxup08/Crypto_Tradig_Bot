'use client';

import Link from 'next/link';
import { FileText, ArrowRight, TrendingUp, LineChart, Shield, HelpCircle } from 'lucide-react';

export default function ReportCenterPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6 relative">
      {/* Floating Animated Background Blobs */}
      <div className="absolute top-12 left-10 w-72 h-72 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none animate-[float_12s_infinite_ease-in-out]" />
      <div className="absolute bottom-12 right-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none animate-[float-reverse_14s_infinite_ease-in-out]" />

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-25px) scale(1.08); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) scale(1.08); }
          50% { transform: translateY(25px) scale(1); }
        }
        .glossy-glow {
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05);
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-[#0b0b0e]/50 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-3xl relative overflow-hidden glossy-glow shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 right-0 w-[250px] h-[250px] rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[250px] h-[250px] rounded-full bg-blue-500/5 blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/20 border border-emerald-900/50 text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Market Analytics Console</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-r from-zinc-100 via-white to-zinc-450 bg-clip-text text-transparent">
            VIP Performance Report Center
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Select a market category below to analyze trading performance statistics, download verified PDF ledger sheets, or dispatch performance reports directly to Telegram.
          </p>
        </div>
      </div>

      {/* Main Grid: Two Big Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        
        {/* Card 1: Binance Futures */}
        <Link 
          href="/dashboard/summary/binance"
          className="group relative flex flex-col justify-between bg-[#07070a]/80 backdrop-blur-2xl border border-zinc-800/90 hover:border-blue-500/50 p-8 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all duration-500 hover:shadow-blue-500/10 hover:-translate-y-2 hover:scale-[1.01] select-none cursor-pointer overflow-hidden"
        >
          {/* Glossy Sweep Shine Overlay */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 ease-out pointer-events-none" />
          
          {/* Neon Radial Gradient glow on hover */}
          <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-blue-500/0 group-hover:bg-blue-500/5 blur-[60px] transition-all duration-500 pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-blue-950/20 border border-blue-900/40 flex items-center justify-center text-blue-400 transition-all duration-500 group-hover:bg-blue-500 group-hover:text-zinc-950 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-blue-500/30 group-hover:border-transparent relative">
              <span className="absolute inset-0 rounded-2xl bg-blue-500/10 animate-ping group-hover:hidden" />
              <TrendingUp className="w-7 h-7" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-zinc-200 group-hover:text-white transition-colors tracking-tight">
                Binance Futures Summary
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Detailed analysis of leverage perpetual contracts trading, net realized P&L margins, win rate distribution, and overall coin execution ledger.
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between text-xs font-black uppercase tracking-widest text-blue-400 group-hover:text-blue-300 border-t border-zinc-900 pt-5 transition-colors">
            <span>Open Binance Report</span>
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all duration-300 group-hover:bg-blue-500 group-hover:border-transparent group-hover:text-zinc-950">
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>

        {/* Card 2: Deriv Options */}
        <Link 
          href="/dashboard/deriv/summary"
          className="group relative flex flex-col justify-between bg-[#07070a]/80 backdrop-blur-2xl border border-zinc-800/90 hover:border-emerald-500/50 p-8 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all duration-500 hover:shadow-emerald-500/10 hover:-translate-y-2 hover:scale-[1.01] select-none cursor-pointer overflow-hidden"
        >
          {/* Glossy Sweep Shine Overlay */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 ease-out pointer-events-none" />
          
          {/* Neon Radial Gradient glow on hover */}
          <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-emerald-500/0 group-hover:bg-emerald-500/5 blur-[60px] transition-all duration-500 pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-center text-emerald-400 transition-all duration-500 group-hover:bg-emerald-500 group-hover:text-zinc-950 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/30 group-hover:border-transparent relative">
              <span className="absolute inset-0 rounded-2xl bg-emerald-500/10 animate-ping group-hover:hidden" />
              <LineChart className="w-7 h-7" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-zinc-200 group-hover:text-white transition-colors tracking-tight">
                Deriv Options Summary
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Performance overview of Rise/Fall binary options contracts, win/loss rate speeds, stake sizes, and synthetic index settlement ledger.
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between text-xs font-black uppercase tracking-widest text-emerald-400 group-hover:text-emerald-300 border-t border-zinc-900 pt-5 transition-colors">
            <span>Open Deriv Report</span>
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-500 group-hover:border-transparent group-hover:text-zinc-950">
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>

      </div>

      {/* Helper Context Info */}
      <div className="bg-[#0b0b0e]/30 backdrop-blur-md border border-zinc-850 p-5 rounded-2xl flex items-start gap-3.5 max-w-2xl mx-auto relative z-10">
        <HelpCircle className="w-5 h-5 text-zinc-550 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-450 leading-relaxed font-medium">
          Both report centers operate under Jeddah Time (GMT+3) audit intervals and offer direct PDF compiles. Ensure Telegram bot credentials are active in Settings to use the instant broadcast feature.
        </p>
      </div>
    </div>
  );
}
