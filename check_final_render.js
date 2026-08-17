async function checkFinal() {
  try {
    console.log('Pinging Render Status endpoint...');
    const statusRes = await fetch('https://whatsapp-bridge-8ep3.onrender.com/status');
    const statusData = await statusRes.json();
    console.log('Status Response:', statusData);

    console.log('\nPinging Render POST /pair...');
    const pairRes = await fetch('https://whatsapp-bridge-8ep3.onrender.com/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '923111594226' })
    });
    console.log('Pair Status:', pairRes.status);
    console.log('Pair Body:', await pairRes.text());
  } catch (err) {
    console.error('Ping failed:', err.message);
  }
}
checkFinal();
