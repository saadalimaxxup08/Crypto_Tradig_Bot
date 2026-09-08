/**
 * Legacy Binance helper stubs.
 * Deriv is the active trading engine for this system.
 */

export function getBinanceClient(apiKey: string, secretKey: string, isDemo: boolean = true) {
  return {};
}

export async function fetchFuturesBalance(exchange: any): Promise<number> {
  return 0.0;
}

export async function fetchCurrentPrice(exchange: any, symbol: string): Promise<number> {
  return 0.0;
}

export async function placeFuturesOrder(
  exchange: any,
  symbol: string,
  type: string,
  side: 'BUY' | 'SELL',
  amount: number,
  params: any = {}
) {
  return {};
}

export async function cancelAllOpenOrders(exchange: any, symbol: string) {
  return true;
}

export async function closeActivePosition(
  exchange: any,
  symbol: string,
  side: 'BUY' | 'SELL',
  amount: number
) {
  return {};
}
