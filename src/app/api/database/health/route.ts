import { NextResponse } from "next/server";
import { databaseProvider, persistentDatabaseConfigured } from "@/lib/database";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: databaseProvider(),
    configured: persistentDatabaseConfigured(),
    connectivityVerified: false,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
