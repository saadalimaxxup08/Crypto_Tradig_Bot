const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const express = require('express');
const pino = require('pino');
const { createClient } = require('@supabase/supabase-js');

// Parse environment variables
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl && fs.existsSync(path.join(__dirname, '.env.local'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = value;
    }
  });
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

let sock = null;
let latestQr = null;
let connectionState = 'disconnected';
let linkedUser = null;

async function connectToWhatsApp() {
  console.log('Initializing WhatsApp connection via Baileys...');
  try {
    const authFolder = path.join(__dirname, 'auth_info_baileys');
    const credsPath = path.join(authFolder, 'creds.json');

    // 1. Sync credentials from Supabase to local filesystem on startup
    if (!fs.existsSync(credsPath)) {
      console.log('No local credentials file found. Checking Supabase for active WhatsApp session...');
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('whatsapp_session')
          .eq('id', 1)
          .single();
        
        if (!error && data && data.whatsapp_session) {
          if (!fs.existsSync(authFolder)) {
            fs.mkdirSync(authFolder, { recursive: true });
          }
          fs.writeFileSync(credsPath, data.whatsapp_session, 'utf-8');
          console.log('WhatsApp credentials successfully restored from Supabase.');
        }
      } catch (dbErr) {
        console.error('Failed to restore credentials from Supabase:', dbErr.message);
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on('creds.update', async () => {
      // Save locally
      saveCreds();
      // Sync to Supabase in real-time
      try {
        if (fs.existsSync(credsPath)) {
          const credsStr = fs.readFileSync(credsPath, 'utf-8');
          await supabase
            .from('settings')
            .update({ whatsapp_session: credsStr })
            .eq('id', 1);
          console.log('WhatsApp session state synced to Supabase database.');
        }
      } catch (syncErr) {
        console.error('Failed to sync credentials to Supabase:', syncErr.message);
      }
    });

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
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403 || statusCode === 440;
        const shouldReconnect = !isLoggedOut;
        console.log(`WhatsApp connection closed (Status Code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        
        connectionState = 'disconnected';
        linkedUser = null;
        latestQr = null;
        
        if (isLoggedOut) {
          console.log('Session credentials expired, invalid or logged out. Clearing authentication states...');
          // 1. Clear database session key in Supabase
          try {
            await supabase
              .from('settings')
              .update({ whatsapp_session: null })
              .eq('id', 1);
            console.log('Cleared expired WhatsApp session inside Supabase database.');
          } catch (dbClearErr) {
            console.error('Failed to clear expired credentials in Supabase:', dbClearErr.message);
          }

          // 2. Clean local auth folder
          try {
            const authFolder = path.join(__dirname, 'auth_info_baileys');
            if (fs.existsSync(authFolder)) {
              fs.rmSync(authFolder, { recursive: true, force: true });
              console.log('Wiped local session credentials folder.');
            }
          } catch (fsErr) {
            console.error('Failed to clear auth folder on disk:', fsErr.message);
          }

          // Restart fresh immediately to generate new QR/Pairing code
          setTimeout(connectToWhatsApp, 1000);
        } else {
          // Reconnect with exponential backup
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

app.get('/', (req, res) => {
  res.json({
    service: 'WhatsApp Bridge Microservice',
    status: connectionState,
    connected_user: linkedUser,
    uptime: `${Math.floor(process.uptime())}s`,
    version: '1.1.0'
  });
});

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

    // Clear session credentials inside Supabase settings table
    try {
      await supabase
        .from('settings')
        .update({ whatsapp_session: null })
        .eq('id', 1);
      console.log('Cleared WhatsApp session inside Supabase database.');
    } catch (dbClearErr) {
      console.error('Failed to clear credentials in Supabase settings:', dbClearErr.message);
    }

    // Restart connection setup to get a new QR code
    setTimeout(connectToWhatsApp, 1000);
    res.json({ success: true });
  } catch (err) {
    console.error('Error during unlinking:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/pair', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  if (connectionState === 'connected') {
    return res.status(400).json({ error: 'WhatsApp is already connected. Please unlink first.' });
  }

  try {
    const sanitized = phone.replace(/[^0-9]/g, '');
    if (sanitized.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number format. Must include country code.' });
    }

    console.log(`Requesting WhatsApp pairing code for phone number: ${sanitized}`);
    
    if (!sock) {
      return res.status(500).json({ error: 'WhatsApp connection socket is initializing. Please try again in 5 seconds.' });
    }

    const code = await sock.requestPairingCode(sanitized);
    console.log(`Pairing code generated: ${code}`);
    res.json({ success: true, code });
  } catch (err) {
    console.error('Error generating pairing code:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Standalone WhatsApp Bridge Microservice is listening on port ${PORT}`);
  
  // Clear the spawn lock file on successful startup
  try {
    const lockPath = path.join(__dirname, 'whatsapp_spawn.lock');
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      console.log('Removed WhatsApp Bridge startup lock file.');
    }
  } catch (err) {
    console.error('Failed to remove lock file:', err.message);
  }
});
