import ccxt from 'ccxt';

/**
 * Get configured Binance client (configured for Futures Testnet by default)
 */
export function getBinanceClient(apiKey: string, secretKey: string, isDemo: boolean = true) {
  if (!apiKey || !secretKey) {
    throw new Error('Binance API Key and Secret are required.');
  }

  const exchange = new ccxt.binanceusdm({
    apiKey: apiKey,
    secret: secretKey,
    enableRateLimit: true,
  });

  // Enable/Disable Binance Demo Trading dynamically
  exchange.enableDemoTrading(isDemo);

  // Configure outbound HTTP proxy if set in env (essential for Vercel static IP whitelisting)
  if (process.env.BINANCE_PROXY) {
    exchange.proxy = process.env.BINANCE_PROXY;
  }

  return exchange;
}

/**
 * Fetch USDT balance on Futures account
 */
export async function fetchFuturesBalance(exchange: any): Promise<number> {
  try {
    const balance = await exchange.fetchBalance();
    // In Futures, the balance details are in the 'info' or specific 'USDT' key
    return parseFloat(balance.total['USDT'] || 0);
  } catch (error) {
    console.error('Error fetching Binance balance:', error);
    throw error;
  }
}

/**
 * Fetch current market price for a symbol (e.g. BTCUSDT)
 */
export async function fetchCurrentPrice(exchange: any, symbol: string): Promise<number> {
  try {
    const ticker = await exchange.fetchTicker(symbol);
    return ticker.close || ticker.last;
  } catch (error) {
    console.error(`Error fetching ticker for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Place a Market Trade with TP/SL Bracket Orders
 */
export async function placeFuturesOrder(
  exchange: any,
  symbol: string,
  direction: 'LONG' | 'SHORT',
  riskAmount: number, // Margin per trade (e.g. 10 USDT)
  tpPercent: number,  // e.g. 2.0 (representing 2%)
  slPercent: number,  // e.g. 1.0 (representing 1%)
  leverage: number = 20 // Leverage (e.g. 20x)
): Promise<{
  entryOrder: any;
  tpOrder: any;
  slOrder: any;
  entryPrice: number;
  amount: number;
}> {
  try {
    // Set leverage on Binance USD-M Futures before opening the trade
    try {
      await exchange.setLeverage(leverage, symbol);
      console.log(`Successfully set leverage to ${leverage}x for ${symbol}`);
    } catch (e: any) {
      console.warn(`Failed to set leverage for ${symbol}: ${e.message}. Proceeding with default.`);
    }

    // 1. Get current price to calculate size and TP/SL levels
    const currentPrice = await fetchCurrentPrice(exchange, symbol);

    // Position Size = Margin (riskAmount) * Leverage
    const totalPositionSize = riskAmount * leverage;

    // Calculate order amount in base currency (e.g. BTC)
    const rawAmount = totalPositionSize / currentPrice;
    const amount = parseFloat(exchange.amountToPrecision(symbol, rawAmount));

    if (amount <= 0) {
      throw new Error(`Calculated size ${amount} is too small for position size ${totalPositionSize} USDT.`);
    }

    // 2. Place entry Market Order
    const side = direction === 'LONG' ? 'buy' : 'sell';
    console.log(`Placing entry market order for ${symbol}: ${side} ${amount}`);
    const entryOrder = await exchange.createMarketOrder(symbol, side, amount);

    // Get actual entry price from order details if available, otherwise fallback to currentPrice
    const entryPrice = entryOrder.average || entryOrder.price || currentPrice;

    // Add a short delay (500ms) to allow Binance (especially Testnet) 
    // to settle the position before placing reduceOnly orders.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Calculate TP/SL prices
    let tpPrice: number;
    let slPrice: number;

    if (direction === 'LONG') {
      tpPrice = entryPrice * (1 + tpPercent / 100);
      slPrice = entryPrice * (1 - slPercent / 100);
    } else {
      tpPrice = entryPrice * (1 - tpPercent / 100);
      slPrice = entryPrice * (1 + slPercent / 100);
    }

    const formattedTpPrice = parseFloat(exchange.priceToPrecision(symbol, tpPrice));
    const formattedSlPrice = parseFloat(exchange.priceToPrecision(symbol, slPrice));

    // Exit side is opposite of entry side
    const exitSide = direction === 'LONG' ? 'sell' : 'buy';

    console.log(`Entry: ${entryPrice}, TP: ${formattedTpPrice}, SL: ${formattedSlPrice}`);

    // 3. Place TP & SL orders in parallel
    // TP: LIMIT order with reduceOnly = true
    // SL: STOP_MARKET order with reduceOnly = true and stopPrice
    const tpPromise = exchange.createOrder(symbol, 'LIMIT', exitSide, amount, formattedTpPrice, {
      reduceOnly: true,
      timeInForce: 'GTC', // Good Till Cancelled
    });

    const slPromise = exchange.createOrder(symbol, 'STOP_MARKET', exitSide, amount, undefined, {
      stopPrice: formattedSlPrice,
      reduceOnly: true,
    });

    const [tpOrder, slOrder] = await Promise.all([tpPromise, slPromise]);

    return {
      entryOrder,
      tpOrder,
      slOrder,
      entryPrice,
      amount,
    };
  } catch (error) {
    console.error(`Failed to place orders for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Fetch all active open orders for a symbol (for TP/SL monitoring/cancellation)
 */
export async function fetchOpenOrders(exchange: any, symbol: string) {
  try {
    return await exchange.fetchOpenOrders(symbol);
  } catch (error) {
    console.error(`Error fetching open orders for ${symbol}:`, error);
    return [];
  }
}

/**
 * Cancel all open orders for a symbol (e.g. when position is closed)
 */
export async function cancelAllOpenOrders(exchange: any, symbol: string) {
  try {
    return await exchange.cancelAllOrders(symbol);
  } catch (error) {
    console.error(`Error cancelling open orders for ${symbol}:`, error);
  }
}

/**
 * Close any active position for a symbol
 */
export async function closeActivePosition(
  exchange: any,
  symbol: string,
  direction: 'LONG' | 'SHORT',
  amount: number
) {
  try {
    const exitSide = direction === 'LONG' ? 'sell' : 'buy';
    // Place Market Order to close the position
    const closeOrder = await exchange.createMarketOrder(symbol, exitSide, amount, undefined, {
      reduceOnly: true,
    });
    // Cancel any remaining TP/SL orders
    await cancelAllOpenOrders(exchange, symbol);
    return closeOrder;
  } catch (error) {
    console.error(`Error closing position for ${symbol}:`, error);
    throw error;
  }
}
