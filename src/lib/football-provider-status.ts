import "server-only";
import { parseProviderEnvelope } from "@/lib/football-provider-contract";

type StatusResponse = {
  subscription: { plan?: unknown; active?: unknown; end?: unknown };
  requests: { current?: unknown; limit_day?: unknown };
};

function validStatus(value: unknown): value is StatusResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.subscription === "object" && item.subscription !== null
    && typeof item.requests === "object" && item.requests !== null;
}

export async function reconcileProviderStatus() {
  const key = process.env.API_FOOTBALL_KEY ?? process.env.API_SPORTS_KEY;
  if (!key) throw new Error("API-Football is not configured");
  const base = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";
  const response = await fetch(new URL("/status", base), {
    headers: { "x-apisports-key": key }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Provider status unavailable (${response.status})`);
  const envelope = parseProviderEnvelope(await response.json(), validStatus);
  const subscription = envelope.response.subscription;
  const requests = envelope.response.requests;
  return {
    plan: typeof subscription.plan === "string" ? subscription.plan : null,
    active: typeof subscription.active === "boolean" ? subscription.active : null,
    subscriptionEndsAt: typeof subscription.end === "string" ? subscription.end : null,
    requestsCurrent: Number.isInteger(requests.current) ? Number(requests.current) : null,
    requestsDailyLimit: Number.isInteger(requests.limit_day) ? Number(requests.limit_day) : null,
    checkedAt: new Date().toISOString(),
  };
}
