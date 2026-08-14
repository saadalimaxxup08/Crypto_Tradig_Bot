import { createClient } from '@supabase/supabase-js';
import { getBinanceClient } from './src/lib/binance';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (!settings) return;

  const realKey = settings.binance_real_api_key || '';
  const realSecret = settings.binance_real_secret_key || '';

  if (!realKey || !realSecret) {
    console.log('Real keys not configured!');
    return;
  }

  const exchange = getBinanceClient(realKey, realSecret, false);

  try {
    console.log('Fetching last 10 orders/trades for 1000SHIB/USDT on Binance...');
    
    // Fetch last 10 trades
    const trades = await exchange.fetchMyTrades('1000SHIB/USDT:USDT', undefined, 10);
    console.log('\n--- BINANCE TRADE LOGS (Last 10 Filled Trades) ---');
    trades.forEach((t: any) => {
      console.log(`- Time: ${t.datetime}`);
      console.log(`  Order ID: ${t.order}`);
      console.log(`  Side: ${t.side}`);
      console.log(`  Price: ${t.price}`);
      console.log(`  Amount: ${t.amount}`);
      console.log(`  Cost: ${t.cost} USDT`);
    });

    // Fetch open orders
    const openOrders = await exchange.fetchOpenOrders('1000SHIB/USDT:USDT');
    console.log('\n--- BINANCE OPEN ORDERS (TP/SL) ---');
    openOrders.forEach((o: any) => {
      console.log(`- Order ID: ${o.id}, Side: ${o.side}, Type: ${o.type}, Price: ${o.price}, Amount: ${o.amount}, Status: ${o.status}`);
    });

  } catch (err: any) {
    console.error('Error fetching trade history from Binance:', err.message);
  }
}

check();
