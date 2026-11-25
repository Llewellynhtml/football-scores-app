import { NextRequest, NextResponse } from "next/server";
import { getApiUsage } from "@/lib/api-usage";
import { readDurableUsage } from "@/lib/football-persistence";
import { reconcileProviderStatus } from "@/lib/football-provider-status";
import { getDatabaseDiagnostics } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let durableUsage = null;
  let providerStatus = null;
  if (process.env.FOOTBALL_PERSISTENCE_ENABLED?.trim().toLowerCase() === "true") {
    try { durableUsage = await readDurableUsage(); }
    catch { console.error("Durable usage query failed", { type: "ExternalServiceError" }); }
  }
  if (request.nextUrl.searchParams.get("reconcile") === "true") {
    try { providerStatus = await reconcileProviderStatus(); }
    catch { providerStatus = { available: false, checkedAt: new Date().toISOString() }; }
  }
  const localUsage = getApiUsage();
  const databaseDiagnostics = getDatabaseDiagnostics();
  const databaseOperationCount = databaseDiagnostics
    ? Object.values(databaseDiagnostics.databaseOperations.operations).reduce((sum, operation) => sum + operation.count, 0)
    : 0;
  const observedRequests = localUsage.cacheHits + localUsage.providerFetchInvocations + localUsage.deduplicatedRequests;
  const cacheReadCount = databaseDiagnostics?.databaseOperations.operations["cache.read"]?.count ?? 0;
  return NextResponse.json({
    instanceId: process.env.APP_INSTANCE_ID ?? null,
    durableUsage,
    providerStatus,
    databaseDiagnostics,
    derivedDiagnostics: {
      databaseOperationsPerObservedRequest: observedRequests ? databaseOperationCount / observedRequests : null,
      persistentCacheHitRatio: cacheReadCount ? localUsage.cacheHits / cacheReadCount : null,
    },
    ...localUsage,
    note: "providerFetchInvocations is process-local: in persistence mode each invocation is an outbound no-store attempt; with persistence disabled Next may satisfy it from its fetch cache. durableUsage.outbound_calls counts no-store outbound attempts. Provider quota headers are provider-reported consumption and retain their last valid values when absent.",
  }, { headers: { "Cache-Control": "no-store" } });
}
