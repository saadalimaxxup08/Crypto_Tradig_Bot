import { NextResponse } from 'next/server';
import { GET as handleDerivCron } from '@/app/api/deriv/cron/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDerivCron(request);
}

export async function POST(request: Request) {
  return handleDerivCron(request);
}
