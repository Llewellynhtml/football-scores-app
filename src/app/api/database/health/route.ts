import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export function GET() {
  const config = getSupabaseConfig();

  return NextResponse.json({
    ok: true,
    service: "supabase",
    configured: config.configured,
    urlConfigured: Boolean(config.url),
    keyConfigured: Boolean(config.anonKey),
    timestamp: new Date().toISOString(),
  });
}
