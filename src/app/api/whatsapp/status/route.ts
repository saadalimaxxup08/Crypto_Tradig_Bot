import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

function getCandidateUrls() {
  return [
    process.env.WHATSAPP_BRIDGE_URL,
    process.env.NEXT_PUBLIC_WHATSAPP_BRIDGE_URL,
    'http://127.0.0.1:3001',
    'http://localhost:3001'
  ].filter(Boolean) as string[];
}

function autoSpawnBridge() {
  try {
    const bridgePath = path.join(process.cwd(), 'whatsapp-bridge.js');
    if (!fs.existsSync(bridgePath)) {
      return;
    }

    const lockPath = path.join(process.cwd(), 'whatsapp_spawn.lock');
    if (fs.existsSync(lockPath)) {
      const stat = fs.statSync(lockPath);
      if (Date.now() - stat.mtimeMs < 15000) {
        return;
      }
    }
    fs.writeFileSync(lockPath, String(Date.now()), 'utf-8');

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
  const candidateUrls = getCandidateUrls();
  let resData: any = null;

  for (const baseUrl of candidateUrls) {
    try {
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (res.ok) {
        resData = await res.json();
        break;
      }
    } catch (e) {
      // try next candidate
    }
  }

  if (resData) {
    return NextResponse.json(resData);
  }

  autoSpawnBridge();
  
  return NextResponse.json({
    status: 'connecting',
    user: null,
    qr: null,
    error: `WhatsApp Bridge microservice is booting up. Please wait 10-15 seconds...`,
  });
}

export async function POST() {
  const candidateUrls = getCandidateUrls();
  let resData: any = null;

  for (const baseUrl of candidateUrls) {
    try {
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const res = await fetch(`${cleanUrl}/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (res.ok) {
        resData = await res.json();
        break;
      }
    } catch (e) {
      // try next candidate
    }
  }

  if (resData) {
    return NextResponse.json(resData);
  }

  return NextResponse.json({
    success: false,
    error: `Could not connect to WhatsApp Bridge microservice.`,
  }, { status: 500 });
}
