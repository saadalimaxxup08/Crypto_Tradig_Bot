import { NextResponse } from 'next/server';
import { GET as handleDerivTrades } from '@/app/api/deriv/trades/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDerivTrades(request);
}

export async function POST(request: Request) {
  return handleDerivTrades(request);
}
