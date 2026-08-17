async function testPair() {
  try {
    console.log('Pinging Render /pair endpoint...');
    const res = await fetch('https://whatsapp-bridge-8ep3.onrender.com/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+966568033766' })
    });
    console.log('Response HTTP Status:', res.status);
    console.log('Response Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Response Body (first 500 chars):', text.slice(0, 500));
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}
testPair();
