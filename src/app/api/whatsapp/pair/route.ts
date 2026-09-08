import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const bridgeUrl = process.env.WHATSAPP_BRIDGE_URL || process.env.NEXT_PUBLIC_WHATSAPP_BRIDGE_URL || 'http://localhost:3001';

    let res: Response | null = null;
    let attempts = 0;

    while (attempts < 2) {
      attempts++;
      try {
        res = await fetch(`${bridgeUrl}/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
          cache: 'no-store'
        });
        if (res.ok || res.status === 400) break;
      } catch (e) {
        if (attempts >= 2) throw e;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (!res) {
      return NextResponse.json({
        success: false,
        error: 'WhatsApp service is initializing. Please wait 10-15 seconds and try requesting pairing code again.'
      }, { status: 503 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({
        success: false,
        error: `WhatsApp service is booting up (HTTP ${res.status}). Please wait 15 seconds and try again!`
      }, { status: 502 });
    }

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data.error || 'Failed to request pairing code' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'WhatsApp service is waking up in the background. Please wait 10-15 seconds and click Get Pairing Code again.'
    }, { status: 503 });
  }
}
