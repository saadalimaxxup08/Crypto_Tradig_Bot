import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

function getBridgeUrl() {
  return process.env.WHATSAPP_BRIDGE_URL || process.env.NEXT_PUBLIC_WHATSAPP_BRIDGE_URL || 'http://localhost:3001';
}

function autoSpawnBridge() {
  try {
    const bridgePath = path.join(process.cwd(), 'whatsapp-bridge.js');
    if (!fs.existsSync(bridgePath)) {
      console.error('WhatsApp bridge script not found at:', bridgePath);
      return;
    }

    const lockPath = path.join(process.cwd(), 'whatsapp_spawn.lock');
    if (fs.existsSync(lockPath)) {
      const stat = fs.statSync(lockPath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 15000) {
        return;
      }
    }
    fs.writeFileSync(lockPath, String(Date.now()), 'utf-8');

    console.log('Spawning WhatsApp Bridge microservice in background with logging...');
    const logFile = path.join(process.cwd(), 'whatsapp-bridge.log');
    const out = fs.openSync(logFile, 'a');
    
    const child = spawn('node', [bridgePath], {
      detached: true,
      stdio: ['ignore', out, out],
      cwd: process.cwd(),
      shell: true
    });
    child.unref();
  } catch (spawnErr) {
    console.error('Failed to spawn WhatsApp Bridge process:', spawnErr);
  }
}

export async function GET() {
  const bridgeUrl = getBridgeUrl();
  try {
    const res = await fetch(`${bridgeUrl}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`WhatsApp Bridge returned status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    autoSpawnBridge();
    
    return NextResponse.json({
      status: 'connecting',
      user: null,
      qr: null,
      error: `WhatsApp Bridge is booting up in the background. Please wait 10-15 seconds...`,
    });
  }
}

export async function POST() {
  const bridgeUrl = getBridgeUrl();
  try {
    const res = await fetch(`${bridgeUrl}/unlink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`WhatsApp Bridge returned status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: `Could not connect to WhatsApp Bridge: ${err.message}`,
    }, { status: 500 });
  }
}
