import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import WebSocket from 'ws';

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

export async function GET(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appId, token, demoAccount, realAccount } = await getDerivCredentials();

  try {
    let detailedTrades: any[] = [];
    let useFallback = false;

    // 1. Fetch up to 5000 trades from Supabase
    const { data, error } = await supabase
      .from('deriv_trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      console.warn('deriv_trades table missing or error, using in-memory fallback:', error.message);
      detailedTrades = [...fallbackTrades];
      useFallback = true;
    } else {
      detailedTrades = data || [];
    }

    // 2. Fetch all open trades in the database
    const openTrades = detailedTrades.filter(t => t.status === 'OPEN');
    const livePrices: Record<string, number> = {};

    // 3. Sync open trades and fetch live price (current_spot) from Deriv
    if (openTrades.length > 0 && appId && token) {
      const activeAccount = openTrades[0].is_paper ? demoAccount : realAccount;
      if (activeAccount) {
        try {
          const wsUrl = await fetchOTP(appId, token, activeAccount);
          const socket = new WebSocket(wsUrl);

          const syncPromises = openTrades.map(trade => {
            return new Promise<void>((resolve) => {
              const handleMessage = async (event: any) => {
                try {
                  const msg = JSON.parse(event.data);
                  if (msg.error) {
                    resolve();
                    return;
                  }

                  if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract) {
                    const contract = msg.proposal_open_contract;
                    const contractId = contract.contract_id;

                    if (contractId === trade.contract_id) {
                      const isExpired = contract.is_expired;
                      const status = isExpired
                        ? (contract.profit > 0 ? 'WON' : 'LOST')
                        : 'OPEN';

                      const pnl = parseFloat(contract.profit || 0);
                      const exitPrice = contract.exit_tick ? parseFloat(contract.exit_tick) : (contract.exit_spot ? parseFloat(contract.exit_spot) : null);
                      const entryPrice = contract.entry_tick ? parseFloat(contract.entry_tick) : (contract.entry_spot ? parseFloat(contract.entry_spot) : trade.entry_price);
                      const currentSpot = contract.current_spot ? parseFloat(contract.current_spot) : entryPrice;

                      // Track live price for UI summary
                      livePrices[trade.symbol] = currentSpot;

                      // Update local trade record reference
                      trade.status = status;
                      trade.pnl = pnl;
                      trade.exit_price = exitPrice;
                      trade.entry_price = entryPrice;
                      if (isExpired) {
                        trade.closed_at = new Date().toISOString();
                      }

                      // Persist to Supabase if not fallback
                      if (!useFallback) {
                        await supabase
                          .from('deriv_trades')
                          .update({
                            status,
                            pnl,
                            exit_price: exitPrice,
                            entry_price: entryPrice,
                            closed_at: isExpired ? new Date().toISOString() : null
                          })
                          .eq('id', trade.id);
                      } else {
                        // Update in fallback array
                        const index = fallbackTrades.findIndex(t => t.id === trade.id);
                        if (index !== -1) {
                          fallbackTrades[index] = { ...trade };
                        }
                      }
                      resolve();
                    }
                  }
                } catch (e) {
                  resolve();
                }
              };

              socket.on('message', handleMessage);

              // Query contract details
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  proposal_open_contract: 1,
                  contract_id: trade.contract_id
                }));
              } else {
                socket.on('open', () => {
                  socket.send(JSON.stringify({
                    proposal_open_contract: 1,
                    contract_id: trade.contract_id
                  }));
                });
              }

              // Safety timeout
              setTimeout(() => {
                socket.off('message', handleMessage);
                resolve();
              }, 4000);
            });
          });

          await Promise.all(syncPromises);
          socket.close();
        } catch (syncErr) {
          console.error('Error syncing Deriv contracts inside trades endpoint:', syncErr);
        }
      }
    }

    // 4. Return same data structure as Binance trades endpoint
    return NextResponse.json({
      success: true,
      trades: detailedTrades,
      detailedTrades,
      allRawTrades: detailedTrades, // Same for simpler lookup
      openTrades,
      livePrices,
      isFallback: useFallback
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
