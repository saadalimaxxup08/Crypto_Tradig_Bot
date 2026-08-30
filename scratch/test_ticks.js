const WebSocket = require('ws');

const appId = '34fHo34ULaDm8k2N5ZSrg';
const token = 'pat_b0b629cfc2e3615287ae5b49f5df182a23281fcfb85759e4a837329b73f7bd0c';
const symbol = 'stpRNG5';

const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
console.log('Connecting to WebSocket...');
const ws = new WebSocket(wsUrl, {
  origin: 'https://cryptotradigbot-production.up.railway.app'
});

ws.on('open', () => {
  console.log('Connected! Sending authorize...');
  ws.send(JSON.stringify({ authorize: token }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('MSG RECEIVED:', msg.msg_type, JSON.stringify(msg));

  if (msg.msg_type === 'authorize') {
    if (msg.error) {
      console.error('Auth Error:', msg.error.message);
      ws.close();
    } else {
      console.log('Authorized! Requesting ticks for:', symbol);
      ws.send(JSON.stringify({ ticks: symbol }));
    }
  }

  if (msg.msg_type === 'tick') {
    console.log('🟢 TICK RECEIVED successfully!');
    ws.close();
  }

  if (msg.error && msg.echo_req.ticks === symbol) {
    console.error('🔴 Tick Request Failed:', msg.error.message);
    ws.close();
  }
});

ws.on('error', (err) => {
  console.error('WS Error:', err.message);
});

setTimeout(() => {
  console.log('Timeout reached, closing.');
  ws.close();
}, 8000);
