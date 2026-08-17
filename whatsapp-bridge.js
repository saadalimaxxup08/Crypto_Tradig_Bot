const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const express = require('express');
const pino = require('pino');

const app = express();
app.use(express.json());

const PORT = 3001;

let sock = null;
let latestQr = null;
let connectionState = 'disconnected';
let linkedUser = null;

async function connectToWhatsApp() {
  console.log('Initializing WhatsApp connection via Baileys...');
  try {
    const authFolder = path.join(__dirname, 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        try {
          latestQr = await qrcode.toDataURL(qr);
          connectionState = 'disconnected';
          console.log('New WhatsApp QR code generated. Ready for scanning.');
        } catch (err) {
          console.error('Error generating QR code base64:', err);
        }
      }

      if (connection === 'connecting') {
        connectionState = 'connecting';
        console.log('Connecting to WhatsApp Web...');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`WhatsApp connection closed (Status Code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        
        connectionState = 'disconnected';
        linkedUser = null;
        
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 5000);
        }
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connection is active and open!');
        connectionState = 'connected';
        latestQr = null;
        const userJid = sock.user.id;
        linkedUser = userJid.split(':')[0] || userJid.split('@')[0];
      }
    });

  } catch (err) {
    console.error('Failed to connect to WhatsApp:', err.message);
    connectionState = 'disconnected';
    setTimeout(connectToWhatsApp, 10000);
  }
}

// Start WhatsApp Bridge
connectToWhatsApp();

// HTTP Endpoints for Next.js interface
app.get('/status', (req, res) => {
  res.json({
    status: connectionState,
    user: linkedUser,
    qr: latestQr
  });
});

app.post('/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Parameters "to" and "message" are required.' });
  }

  if (connectionState !== 'connected' || !sock) {
    return res.status(500).json({ error: 'WhatsApp Bridge client is not connected yet.' });
  }

  try {
    let formattedJid = to.trim();
    if (!formattedJid.includes('@')) {
      if (formattedJid.includes('-') || formattedJid.length > 15) {
        // Group ID
        formattedJid = formattedJid.endsWith('@g.us') ? formattedJid : `${formattedJid}@g.us`;
      } else {
        // Personal number format
        let numericOnly = formattedJid.replace(/[^0-9]/g, '');
        formattedJid = `${numericOnly}@s.whatsapp.net`;
      }
    }

    console.log(`Sending message to ${formattedJid}...`);
    await sock.sendMessage(formattedJid, { text: message });
    res.json({ success: true });
  } catch (err) {
    console.error('Error sending message:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/unlink', async (req, res) => {
  console.log('Unlinking WhatsApp connection...');
  try {
    if (sock) {
      try {
        await sock.logout();
      } catch (logoutErr) {
        console.warn('Logout failed or already logged out:', logoutErr.message);
      }
    }
    
    const authFolder = path.join(__dirname, 'auth_info_baileys');
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log('Authentication session directory cleaned.');
    }

    connectionState = 'disconnected';
    linkedUser = null;
    latestQr = null;

    // Restart connection setup to get a new QR code
    setTimeout(connectToWhatsApp, 1000);
    res.json({ success: true });
  } catch (err) {
    console.error('Error during unlinking:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Standalone WhatsApp Bridge Microservice is listening on port ${PORT}`);
});
