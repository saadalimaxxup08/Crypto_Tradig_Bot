import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getDerivBalances(appId: string, token: string) {
  try {
    const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
      method: 'GET',
      headers: {
        'Deriv-App-ID': appId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      const resData = await response.json();
      if (resData && resData.data) {
        const demo = resData.data.find((a: any) => a.account_type === 'demo');
        const real = resData.data.find((a: any) => a.account_type === 'real');
        return {
          demoBalance: demo ? parseFloat(demo.balance) : 0.00,
          realBalance: real ? parseFloat(real.balance) : 0.00
        };
      }
    }
  } catch (e) {
    console.error("Failed to fetch Deriv balances:", e);
  }
  return { demoBalance: 0.00, realBalance: 0.00 };
}

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

    const appId = settings?.deriv_app_id || process.env.DERIV_APP_ID || '';
    const token = settings?.deriv_api_token || process.env.DERIV_API_TOKEN || '';
    const demoAccount = settings?.deriv_demo_account || process.env.DERIV_DEMO_ACCOUNT || '';
    const realAccount = settings?.deriv_real_account || process.env.DERIV_REAL_ACCOUNT || '';
    const tradingMode = settings?.deriv_trading_mode || 'DEMO';
    const botEnabled = settings?.deriv_bot_enabled || false;
    const overrides = settings?.pair_overrides || {};
    const lastScanAt = overrides.deriv_last_scan_at || '';
    const lastScanLogs = overrides.deriv_last_scan_logs || [];
    const activeStrategies = overrides.deriv_active_strategies || ['FOREX_15M_MTF'];
    const derivMaxTrades = overrides.deriv_max_trades || 10;
    const derivStakeAmount = overrides.deriv_stake_amount || 1.00;

    let demoBalance = 0.00;
    let realBalance = 0.00;

    if (appId && token) {
      const balances = await getDerivBalances(appId, token);
      demoBalance = balances.demoBalance;
      realBalance = balances.realBalance;
    }

    if (error) {
      return NextResponse.json({
        success: true,
        appId,
        apiToken: token,
        demoAccount,
        realAccount,
        tradingMode,
        botEnabled,
        activeStrategies,
        derivMaxTrades,
        derivStakeAmount,
        demoBalance,
        realBalance,
        lastScanAt,
        lastScanLogs,
        isFallback: true
      });
    }

    return NextResponse.json({
      success: true,
      appId,
      apiToken: token,
      demoAccount,
      realAccount,
      tradingMode,
      botEnabled,
      activeStrategies,
      derivMaxTrades,
      derivStakeAmount,
      demoBalance,
      realBalance,
      lastScanAt,
      lastScanLogs,
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
    const body = await request.json();
    const { appId, apiToken, demoAccount, realAccount, tradingMode, botEnabled, activeStrategies, derivMaxTrades, derivStakeAmount } = body;

    // Fetch existing overrides to merge them
    const { data: settings } = await supabase
      .from('settings')
      .select('pair_overrides')
      .eq('id', 1)
      .single();

    const existingOverrides = settings?.pair_overrides || {};
    const updatedOverrides = {
      ...existingOverrides,
      deriv_active_strategies: activeStrategies || ['FOREX_15M_MTF'],
      deriv_max_trades: derivMaxTrades !== undefined ? parseInt(derivMaxTrades) : (existingOverrides.deriv_max_trades || 10),
      deriv_stake_amount: derivStakeAmount !== undefined ? parseFloat(derivStakeAmount) : (existingOverrides.deriv_stake_amount || 1.00)
    };

    const updatePayload: any = {
      deriv_app_id: appId,
      deriv_api_token: apiToken,
      deriv_demo_account: demoAccount,
      deriv_real_account: realAccount,
      deriv_trading_mode: tradingMode,
      deriv_bot_enabled: botEnabled,
      pair_overrides: updatedOverrides
    };

    const { error } = await supabase
      .from('settings')
      .update(updatePayload)
      .eq('id', 1);

    if (error) {
      console.warn('Failed to save settings, trying fallback settings update...');
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.deriv_bot_enabled;
      delete fallbackPayload.deriv_trading_mode;

      const { error: fallbackError } = await supabase
        .from('settings')
        .update(fallbackPayload)
        .eq('id', 1);

      if (fallbackError) {
        return NextResponse.json({
          success: false,
          error: 'Supabase settings update failed.',
          details: fallbackError.message
        }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
