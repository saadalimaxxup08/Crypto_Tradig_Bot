import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { recipient } = await req.json();
    if (!recipient) {
      return NextResponse.json({ success: false, error: 'Recipient is required' }, { status: 400 });
    }

    const bridgeUrl = process.env.NEXT_PUBLIC_WHATSAPP_BRIDGE_URL || 'http://localhost:3001';
    const testMessage = `🔔 *[TEST]* This is a manual WhatsApp configuration test from your Crypto Trading Bot dashboard. If you receive this, it means notifications are working perfectly for your contact!`;

    const res = await fetch(`${bridgeUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: recipient, message: testMessage }),
    });

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: false, error: data.error || 'Failed to send test message via bridge' }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
