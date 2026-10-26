import { NextResponse } from "next/server";
import { getApiUsage } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ...getApiUsage(),
    note: "outboundCalls is process-local; providerRemaining reflects the latest API-Football rate-limit header seen by this process.",
  });
}
