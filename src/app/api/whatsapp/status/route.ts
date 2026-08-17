import { NextResponse } from 'next/server';

const BRIDGE_URL = 'http://localhost:3001';

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
    return NextResponse.json({
      status: 'disconnected',
      user: null,
      qr: null,
      error: `Could not connect to WhatsApp Bridge: ${err.message}`,
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
