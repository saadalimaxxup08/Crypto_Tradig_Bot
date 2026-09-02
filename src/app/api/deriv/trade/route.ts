import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import WebSocket from 'ws';
import { syncOpenTrades } from '@/lib/deriv_api_helpers';

export const dynamic = 'force-dynamic';

// Temporary in-memory fallback store in case Supabase deriv_trades table is not created yet
let fallbackTrades: any[] = [];

// Helper to get Deriv Credentials
async function getDerivCredentials() {
  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();

  const appId = settings?.deriv_app_id || process.env.DERIV_APP_ID || '';
  const token = settings?.deriv_api_token || process.env.DERIV_API_TOKEN || '';
  const demoAccount = settings?.deriv_demo_account || process.env.DERIV_DEMO_ACCOUNT || '';
  const realAccount = settings?.deriv_real_account || process.env.DERIV_REAL_ACCOUNT || '';

  return { appId, token, demoAccount, realAccount };
}

// Fetch OTP from Deriv REST API
async function fetchOTP(appId: string, token: string, accountId: string) {
  const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`;
  const response = await fetch(otpUrl, {
    method: 'POST',
    headers: {
      'Deriv-App-ID': appId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status !== 200) {
    throw new Error(`Failed to generate OTP: ${await response.text()}`);
  }

  const otpData = await response.json();
  return otpData.data.url;
}

// GET: Fetch recent trades and sync any OPEN trades from Deriv
export async function GET(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appId, token, demoAccount, realAccount } = await getDerivCredentials();
  if (!appId || !token) {
    return NextResponse.json({ success: true, trades: [], error: 'Credentials missing' });
  }

  try {
    // 1. Fetch trades from DB
    let dbTrades: any[] = [];
    let useFallback = false;

    const { data, error } = await supabase
      .from('deriv_trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('deriv_trades table missing, using in-memory fallback:', error.message);
      dbTrades = [...fallbackTrades];
      useFallback = true;
    } else {
      dbTrades = data || [];
    }

    // 2. Identify open trades to sync
    const openTrades = dbTrades.filter(t => t.status === 'OPEN');

    if (openTrades.length > 0) {
      const activeAccount = openTrades[0].is_paper ? demoAccount : realAccount;
      if (activeAccount) {
        try {
          const wsUrl = await fetchOTP(appId, token, activeAccount);
          const socket = new WebSocket(wsUrl);

          await new Promise<void>((res) => {
            if (socket.readyState === WebSocket.OPEN) res();
            else socket.on('open', () => res());
          });

          await syncOpenTrades(socket, openTrades);
          socket.close();

          // Refetch updated trades
          if (!useFallback) {
            const { data: refreshed } = await supabase
              .from('deriv_trades')
              .select('*')
              .order('created_at', { ascending: false });
            if (refreshed) {
              dbTrades = refreshed;
            }
          }
        } catch (syncErr) {
          console.error('Error syncing Deriv contracts:', syncErr);
        }
      }
    }

    return NextResponse.json({ success: true, trades: dbTrades, isFallback: useFallback });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Execute trade on Deriv Options
export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { symbol, contractType, amount, duration, durationUnit, isPaper } = await request.json();
    const { appId, token, demoAccount, realAccount } = await getDerivCredentials();

    if (!appId || !token) {
      return NextResponse.json({ error: 'Deriv App ID or API Token missing in settings' }, { status: 400 });
    }

    const accountId = isPaper ? demoAccount : realAccount;
    if (!accountId) {
      return NextResponse.json({ error: `Deriv ${isPaper ? 'Demo' : 'Real'} Account ID is missing in settings` }, { status: 400 });
    }

    // 1. Generate OTP
    const wsUrl = await fetchOTP(appId, token, accountId);

    // 2. Open WebSocket to execute buy
    const tradeResult = await new Promise<any>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      let timeoutId = setTimeout(() => {
        socket.close();
        reject(new Error('Deriv API response timed out.'));
      }, 10000);

      socket.onopen = () => {
        // Send Proposal Request
        socket.send(JSON.stringify({
          proposal: 1,
          amount: parseFloat(amount),
          basis: 'stake',
          contract_type: contractType, // CALL or PUT
          currency: 'USD',
          duration: parseInt(duration),
          duration_unit: durationUnit, // s, m, t
          underlying_symbol: symbol
        }));
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data.toString());
          if (msg.error) {
            clearTimeout(timeoutId);
            socket.close();
            reject(new Error(msg.error.message));
            return;
          }

          if (msg.msg_type === 'proposal') {
            // Send Buy Request
            socket.send(JSON.stringify({
              buy: msg.proposal.id,
              price: msg.proposal.ask_price
            }));
          } else if (msg.msg_type === 'buy') {
            clearTimeout(timeoutId);
            socket.close();
            resolve(msg.buy);
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          socket.close();
          reject(e);
        }
      };

      socket.onerror = (err) => {
        clearTimeout(timeoutId);
        socket.close();
        reject(new Error('WebSocket connection error.'));
      };
    });

    // 3. Log trade to database or fallback array
    const newTrade = {
      id: crypto.randomUUID(),
      contract_id: tradeResult.contract_id,
      symbol,
      contract_type: contractType,
      duration: parseInt(duration),
      duration_unit: durationUnit,
      stake: parseFloat(amount),
      payout: parseFloat(tradeResult.payout),
      status: 'OPEN',
      entry_price: parseFloat(tradeResult.buy_price),
      exit_price: null,
      barrier: null,
      pnl: 0,
      is_paper: isPaper,
      created_at: new Date().toISOString(),
      closed_at: null
    };

    let useFallback = false;
    const { error: insertErr } = await supabase
      .from('deriv_trades')
      .insert([newTrade]);

    if (insertErr) {
      console.warn('deriv_trades table missing during insert, using fallback:', insertErr.message);
      fallbackTrades.unshift(newTrade);
      useFallback = true;
    }

    return NextResponse.json({ success: true, trade: newTrade, isFallback: useFallback });
  } catch (err: any) {
    console.error('Deriv execution error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
