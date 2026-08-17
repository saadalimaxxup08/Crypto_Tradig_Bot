import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_CONFIG = {
  whatsapp_enabled: false,
  whatsapp_recipients: [],
  whatsapp_filters: {
    signals: true,
    trades: true,
    hourly: false,
    daily: false
  }
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('whatsapp_config')
      .eq('id', 1)
      .single();

    if (error || !data || !data.whatsapp_config) {
      return NextResponse.json(DEFAULT_CONFIG);
    }

    // Merge database values with default schema to prevent missing fields
    const config = {
      whatsapp_enabled: data.whatsapp_config.whatsapp_enabled ?? DEFAULT_CONFIG.whatsapp_enabled,
      whatsapp_recipients: data.whatsapp_config.whatsapp_recipients ?? DEFAULT_CONFIG.whatsapp_recipients,
      whatsapp_filters: {
        ...DEFAULT_CONFIG.whatsapp_filters,
        ...(data.whatsapp_config.whatsapp_filters || {})
      }
    };

    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Fetch current config
    const { data: current, error: fetchErr } = await supabase
      .from('settings')
      .select('whatsapp_config')
      .eq('id', 1)
      .single();

    let config = DEFAULT_CONFIG;
    if (!fetchErr && current && current.whatsapp_config) {
      config = {
        whatsapp_enabled: current.whatsapp_config.whatsapp_enabled ?? DEFAULT_CONFIG.whatsapp_enabled,
        whatsapp_recipients: current.whatsapp_config.whatsapp_recipients ?? DEFAULT_CONFIG.whatsapp_recipients,
        whatsapp_filters: {
          ...DEFAULT_CONFIG.whatsapp_filters,
          ...(current.whatsapp_config.whatsapp_filters || {})
        }
      };
    }

    // 2. Apply updates
    if (body.whatsapp_enabled !== undefined) {
      config.whatsapp_enabled = !!body.whatsapp_enabled;
    }
    if (body.whatsapp_recipients !== undefined && Array.isArray(body.whatsapp_recipients)) {
      config.whatsapp_recipients = body.whatsapp_recipients;
    }
    if (body.whatsapp_filters !== undefined) {
      config.whatsapp_filters = {
        ...config.whatsapp_filters,
        ...body.whatsapp_filters
      };
    }

    // 3. Update database row
    const { error: updateErr } = await supabase
      .from('settings')
      .update({ whatsapp_config: config })
      .eq('id', 1);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
