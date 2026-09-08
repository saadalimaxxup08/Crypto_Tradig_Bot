import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    message: 'Deriv Options positions expire automatically upon duration elapsed.'
  });
}
