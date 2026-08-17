import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const BRIDGE_URL = 'http://localhost:3001';

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
        console.log('WhatsApp Bridge was spawned recently (lock active). Skipping duplicate spawn.');
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
      cwd: process.cwd()
    });
    child.unref();
  } catch (spawnErr) {
    console.error('Failed to spawn WhatsApp Bridge process:', spawnErr);
  }
}

export async function GET() {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Prevent Next.js from caching the response
      next: { revalidate: 0 },
    } as any);

    if (!res.ok) {
      throw new Error(`WhatsApp Bridge returned status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.log('WhatsApp Bridge port 3001 is offline. Auto-spawning bridge process...');
    autoSpawnBridge();
    
    return NextResponse.json({
      status: 'connecting',
      user: null,
      qr: null,
      error: `WhatsApp Bridge is booting up in the background. Please wait...`,
    });
  }
}

export async function POST() {
  try {
    const res = await fetch(`${BRIDGE_URL}/unlink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
