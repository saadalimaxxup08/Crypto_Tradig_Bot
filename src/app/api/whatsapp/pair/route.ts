import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const bridgeUrl = process.env.NEXT_PUBLIC_WHATSAPP_BRIDGE_URL || 'http://localhost:3001';
    const res = await fetch(`${bridgeUrl}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data.error || 'Failed to request pairing code' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
