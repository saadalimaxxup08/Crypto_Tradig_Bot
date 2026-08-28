const WebSocket = require('ws'); // wait, let's use global.WebSocket if available, or fetch it. In modern Node, global.WebSocket exists. But just in case, we can write a standard ES module or JS file.
// Node 24 has global.WebSocket natively. Let's write a plain Node script.

const ws = new global.WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

ws.onopen = () => {
  console.log('Connected to Deriv WebSocket. Requesting active symbols...');
  ws.send(JSON.stringify({
    active_symbols: 'brief'
  }));
};

ws.onmessage = (event) => {
  try {
    const response = JSON.parse(event.data);
    console.log('Received Message Type:', response.msg_type);
    if (response.error) {
      console.error('API Error Response:', response.error);
    }
    if (response.msg_type === 'active_symbols') {
      const symbols = response.active_symbols || [];
      console.log(`Successfully fetched ${symbols.length} active symbols!`);
      
      // Let's filter and group by market
      const markets = {};
      symbols.forEach(s => {
        const market = s.market_display_name;
        if (!markets[market]) {
          markets[market] = [];
        }
        markets[market].push({
          symbol: s.symbol,
          name: s.display_name,
          submarket: s.submarket_display_name
        });
      });

      console.log('\n======================================================');
      console.log('        AVAILABLE DERIV SYMBOLS BY MARKET CATEGORY');
      console.log('======================================================\n');

      for (const [market, list] of Object.entries(markets)) {
        console.log(`\n📂 MARKET: ${market} (${list.length} assets)`);
        console.log('--------------------------------------------------');
        
        // Group by submarket
        const submarkets = {};
        list.forEach(item => {
          if (!submarkets[item.submarket]) {
            submarkets[item.submarket] = [];
          }
          submarkets[item.submarket].push(`${item.name} (${item.symbol})`);
        });

        for (const [submarket, items] of Object.entries(submarkets)) {
          console.log(`  🔹 ${submarket}:`);
          // Print first 15 items to avoid log spam, indicate if more exist
          const visible = items.slice(0, 15);
          visible.forEach(it => console.log(`     • ${it}`));
          if (items.length > 15) {
            console.log(`     • ... and ${items.length - 15} more assets.`);
          }
        }
      }

      console.log('\n======================================================');
      ws.close();
    }
  } catch (e) {
    console.error('Error parsing msg:', e);
    ws.close();
  }
};

ws.onerror = (err) => {
  console.error('WebSocket Error:', err);
};

ws.onclose = () => {
  console.log('Connection closed.');
};
