'use client';

import Link from 'next/link';
import { FileText, ArrowRight, LineChart, HelpCircle, Shield, Download } from 'lucide-react';

export default function ReportCenterPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6 relative">
      {/* Floating Animated Background Blobs */}
      <div className="absolute top-12 left-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none animate-[float_12s_infinite_ease-in-out]" />
      <div className="absolute bottom-12 right-10 w-72 h-72 rounded-full bg-blue-500/10 blur-[120px] pointer-events-none animate-[float-reverse_14s_infinite_ease-in-out]" />

      {/* Header Banner */}
      <div className="bg-[#0b0b0e]/50 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-3xl relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="absolute top-0 right-0 w-[250px] h-[250px] rounded-full bg-emerald-500/5 blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/20 border border-emerald-900/50 text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Deriv Analytics Console</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight text-white">
            Deriv Performance Report Center
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Analyze trading performance statistics, download verified PDF ledger sheets, or dispatch performance reports directly to Telegram for Deriv Rise/Fall Options.
          </p>
        </div>
      </div>

      {/* Main Single Big Deriv Selection Card */}
      <div className="relative z-10">
        <Link 
          href="/dashboard/deriv/summary"
          className="group relative flex flex-col justify-between bg-[#07070a]/80 backdrop-blur-2xl border border-zinc-800/90 hover:border-emerald-500/50 p-8 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all duration-500 hover:shadow-emerald-500/10 hover:-translate-y-1 select-none cursor-pointer overflow-hidden"
        >
          <div className="space-y-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-center text-emerald-400 transition-all duration-500 group-hover:bg-emerald-500 group-hover:text-zinc-950 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/30 group-hover:border-transparent relative">
              <LineChart className="w-7 h-7" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-zinc-200 group-hover:text-white transition-colors tracking-tight">
                Deriv Options Analytics & PDF Ledger
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium max-w-xl">
                Comprehensive breakdown of Deriv Rise/Fall binary contracts, MTF strategy win-rate speeds, stake sizes, drawdown history, and instant Telegram PDF receipt exports.
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between text-xs font-black uppercase tracking-widest text-emerald-400 group-hover:text-emerald-300 border-t border-zinc-900 pt-5 transition-colors">
            <span>Open Deriv Report Console</span>
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-500 group-hover:border-transparent group-hover:text-zinc-950">
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Helper Context Info */}
      <div className="bg-[#0b0b0e]/30 backdrop-blur-md border border-zinc-850 p-5 rounded-2xl flex items-start gap-3.5 max-w-2xl mx-auto relative z-10">
        <HelpCircle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
          Deriv report centers operate under Saudi/Riyadh Time (GMT+3) audit intervals and offer direct PDF compiles for all filled options contracts.
        </p>
      </div>
    </div>
  );
}
