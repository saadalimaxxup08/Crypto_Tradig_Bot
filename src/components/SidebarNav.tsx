'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  Activity,
  History,
  Settings,
  Shield,
  FileText,
  Beaker,
  Terminal,
  LineChart,
  Cpu,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Deriv Dashboard',
    icon: LineChart,
  },
  {
    href: '/dashboard/martingale',
    label: 'Martingale Strategy Engine',
    icon: TrendingUp,
  },
  {
    href: '/dashboard/scanner',
    label: 'Live Scanner',
    icon: Activity,
  },
  {
    href: '/dashboard/signals',
    label: 'Signals History',
    icon: Shield,
  },
  {
    href: '/dashboard/trades',
    label: 'Trades History',
    icon: History,
  },
  {
    href: '/dashboard/summary',
    label: 'Report Center',
    icon: FileText,
  },
  {
    href: '/dashboard/sandbox',
    label: 'Strategy Sandbox',
    icon: Beaker,
  },
  {
    href: '/dashboard/console',
    label: 'System Terminal',
    icon: Terminal,
  },
  {
    href: '/dashboard/infrastructure',
    label: 'Project Source Performance',
    icon: Cpu,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="p-4 space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${
              isActive
                ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/30 font-extrabold shadow-sm'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-emerald-400 border border-transparent font-medium'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
