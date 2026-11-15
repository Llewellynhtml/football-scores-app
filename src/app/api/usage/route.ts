import { NextRequest, NextResponse } from "next/server";
import { getApiUsage } from "@/lib/api-usage";
import { readDurableUsage } from "@/lib/football-persistence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let durableUsage = null;
  if (process.env.FOOTBALL_PERSISTENCE_ENABLED === "true") {
    try { durableUsage = await readDurableUsage(); }
    catch (error) { console.error("Durable usage query failed", error); }
  }
  return NextResponse.json({
    durableUsage,
    ...getApiUsage(),
    note: "Process-local diagnostic only; not a persistent or complete billing/quota ledger.",
  }, { headers: { "Cache-Control": "no-store" } });
}
