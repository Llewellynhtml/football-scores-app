import { NextRequest, NextResponse } from "next/server";
import { getApiUsage } from "@/lib/api-usage";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    ...getApiUsage(),
    note: "Process-local diagnostic only; not a persistent or complete billing/quota ledger.",
  }, { headers: { "Cache-Control": "no-store" } });
}
