import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'whatsapp_config.json');

function readConfig() {
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      whatsapp_enabled: false,
      whatsapp_recipients: [],
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  }
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {
      whatsapp_enabled: false,
      whatsapp_recipients: [],
    };
  }
}

export async function GET() {
  const config = readConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = readConfig();

    if (body.whatsapp_enabled !== undefined) {
      config.whatsapp_enabled = !!body.whatsapp_enabled;
    }
    if (body.whatsapp_recipients !== undefined && Array.isArray(body.whatsapp_recipients)) {
      config.whatsapp_recipients = body.whatsapp_recipients;
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
