import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const candidateUrls = [
      process.env.WHATSAPP_BRIDGE_URL,
      process.env.NEXT_PUBLIC_WHATSAPP_BRIDGE_URL,
      'http://127.0.0.1:3001',
      'http://localhost:3001'
    ].filter(Boolean) as string[];

    let res: Response | null = null;
    let lastError: string = '';

    for (const baseUrl of candidateUrls) {
      try {
        const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const targetUrl = `${cleanUrl}/pair`;
        
        const tempRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
          cache: 'no-store'
        });

        if (tempRes.ok || tempRes.status === 400 || tempRes.status === 500) {
          res = tempRes;
          break;
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!res) {
      return NextResponse.json({
        success: false,
        error: `WhatsApp microservice is booting up (Internal loopback: ${lastError || 'Connecting'}). Please wait 10-15 seconds and try again!`
      }, { status: 503 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({
        success: false,
        error: `WhatsApp service returned non-JSON response (HTTP ${res.status}). Please wait a moment and try again.`
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
      error: `WhatsApp microservice is initializing. Please wait 10 seconds and click Get Pairing Code again.`
    }, { status: 503 });
  }
}
