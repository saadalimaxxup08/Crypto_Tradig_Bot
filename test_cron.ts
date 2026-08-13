import { GET } from './src/app/api/cron/route';
import { getBinanceClient, fetchCurrentPrice } from './src/lib/binance';
import { analyzeStrategy } from './src/lib/indicators';

async function test() {
  console.log('Testing /api/cron endpoint with full indicators dump...');
  
  const apiKey = process.env.BINANCE_API_KEY || '';
  const secretKey = process.env.BINANCE_SECRET_KEY || '';

  if (!apiKey || !secretKey) {
    console.error('Binance API Key and Secret are required in environment.');
    return;
  }

  try {
    const exchange = getBinanceClient(apiKey, secretKey);
    const pairs = [
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
      'DOGEUSDT', 'ADAUSDT', 'TONUSDT', '1000SHIBUSDT', 'TRXUSDT', // Fixed SHIBUSDT to 1000SHIBUSDT
      'AVAXUSDT', 'DOTUSDT', 'POLUSDT', 'LTCUSDT', 'LINKUSDT',     // Fixed MATICUSDT to POLUSDT
      'ATOMUSDT', 'XLMUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT'
    ];

    console.log(`\n--- CONCURRENT SCAN OF ${pairs.length} PAIRS ---`);
    
    await Promise.all(
      pairs.map(async (pair) => {
        try {
          const ohlcv = await exchange.fetchOHLCV(pair, '1m', undefined, 100);
          if (!ohlcv || ohlcv.length < 35) {
            console.log(`⚠️ ${pair}: Insufficient candles data`);
            return;
          }

          const closePrices = ohlcv.map((candle: any) => candle[4]);
          const currentPrice = closePrices[closePrices.length - 1];
          const { rsi, macdLine, signalLine, direction } = analyzeStrategy(closePrices);

          console.log(
            `📊 ${pair.padEnd(12)} | Price: ${String(currentPrice).padEnd(10)} | RSI: ${rsi.toFixed(2).padEnd(6)} | MACD: ${macdLine.toFixed(4).padEnd(8)} | Signal: ${signalLine.toFixed(4).padEnd(8)} | Trigger: ${direction}`
          );
        } catch (err: any) {
          console.log(`❌ ${pair}: Error scanning - ${err.message}`);
        }
      })
    );

    console.log('\n--- CALLING API/CRON ENDPOINT ---');
    const response = await GET(new Request('http://localhost:3000/api/cron'));
    const data = await response.json();
    console.log('Success:', data.success);
    console.log('Error:', data.error || 'None');
    console.log('API Cron Logs:', data.logs);

  } catch (err: any) {
    console.error('CRITICAL ERROR running test:', err);
  }
}

test();
