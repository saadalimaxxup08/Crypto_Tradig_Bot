import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    candles: {},
    timeframe: '15m',
    message: 'Live Deriv scanner uses WebSocket ticker streaming.'
  });
}
