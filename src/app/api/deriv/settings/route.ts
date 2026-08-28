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
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      return NextResponse.json({
        success: true,
        appId: process.env.DERIV_APP_ID || '',
        apiToken: process.env.DERIV_API_TOKEN || '',
        demoAccount: process.env.DERIV_DEMO_ACCOUNT || '',
        realAccount: process.env.DERIV_REAL_ACCOUNT || '',
        isFallback: true
      });
    }

    return NextResponse.json({
      success: true,
      appId: settings.deriv_app_id || process.env.DERIV_APP_ID || '',
      apiToken: settings.deriv_api_token || process.env.DERIV_API_TOKEN || '',
      demoAccount: settings.deriv_demo_account || process.env.DERIV_DEMO_ACCOUNT || '',
      realAccount: settings.deriv_real_account || process.env.DERIV_REAL_ACCOUNT || '',
      isFallback: false
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { appId, apiToken, demoAccount, realAccount } = await request.json();

    const { error } = await supabase
      .from('settings')
      .update({
        deriv_app_id: appId,
        deriv_api_token: apiToken,
        deriv_demo_account: demoAccount,
        deriv_real_account: realAccount
      })
      .eq('id', 1);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Supabase settings columns missing. Please run the SQL migration query in your Supabase SQL editor to create the Deriv settings columns.',
        details: error.message
      }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
