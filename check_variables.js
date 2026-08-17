async function runTest() {
  try {
    console.log('1. Pinging /status...');
    const statusRes = await fetch('http://localhost:3001/status');
    const statusData = await statusRes.json();
    console.log('Status Response:', statusData);

    console.log('\n2. Pinging /send...');
    const sendRes = await fetch('http://localhost:3001/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '+923111594226', message: 'Hello from test script' })
    });
    const sendData = await sendRes.json();
    console.log('Send Response status:', sendRes.status);
    console.log('Send Response body:', sendData);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
runTest();
