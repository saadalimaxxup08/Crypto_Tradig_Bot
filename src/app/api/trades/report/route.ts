import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: trades } = await supabase
      .from('deriv_trades')
      .select('*')
      .order('timestamp', { ascending: false });

    return NextResponse.json({
      success: true,
      trades: trades || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
