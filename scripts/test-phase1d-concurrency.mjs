import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";

if (process.env.PHASE1D_ISOLATED_DATABASE !== "true" || process.env.SUPABASE_TEST_PROJECT_NAME !== "football-scores-dev") {
  throw new Error("Refusing to run: set PHASE1D_ISOLATED_DATABASE=true and SUPABASE_TEST_PROJECT_NAME=football-scores-dev for an isolated migrated test database.");
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Test Supabase service credentials are required");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rpc = async (name, args) => {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`${name} failed: ${error.code ?? "database_error"}`);
  return data;
};
const cacheKey = createHash("sha256").update(`phase1d-${randomUUID()}`).digest("hex");
const owner1 = randomUUID();
const owner2 = randomUUID();
const scope = `phase1d-${randomUUID()}`;
const attempt1 = randomUUID();
const attempt2 = randomUUID();
const attemptedAt = new Date().toISOString();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  if (await rpc("acquire_football_cache_lease", { p_cache_key: cacheKey, p_owner_token: owner1, p_lease_seconds: 5 }) !== true) throw new Error("initial lease not acquired");
  await wait(5100);
  const expiry = new Date(Date.now() + 60_000).toISOString();
  const stale = new Date(Date.now() + 120_000).toISOString();
  const [oldWrite, newAcquire] = await Promise.all([
    rpc("write_football_cache_if_lease_owner", { p_cache_key: cacheKey, p_payload: [{ owner: "old" }], p_expires_at: expiry, p_stale_until: stale, p_owner_token: owner1 }),
    rpc("acquire_football_cache_lease", { p_cache_key: cacheKey, p_owner_token: owner2, p_lease_seconds: 20 }),
  ]);
  if (oldWrite !== false || newAcquire !== true) throw new Error(`lease fencing failed: oldWrite=${oldWrite} newAcquire=${newAcquire}`);
  if (await rpc("write_football_cache_if_lease_owner", { p_cache_key: cacheKey, p_payload: [{ owner: "new" }], p_expires_at: expiry, p_stale_until: stale, p_owner_token: owner2 }) !== true) throw new Error("new owner write failed");

  const reserveArgs = (attempt) => ({ p_attempt_id: attempt, p_attempted_at: attemptedAt, p_quota_scope: scope, p_essential: true, p_daily_limit: 1, p_reserve: 0, p_minute_limit: 1, p_minute_reserve: 0 });
  const reservations = await Promise.all([rpc("reserve_football_api_quota", reserveArgs(attempt1)), rpc("reserve_football_api_quota", reserveArgs(attempt2))]);
  if (reservations.filter((value) => value === "ACQUIRED").length !== 1 || reservations.filter((value) => value === "DAILY_LIMIT_REACHED").length !== 1) throw new Error(`atomic quota reservation failed: ${reservations.join(",")}`);
  const acquiredAttempt = reservations[0] === "ACQUIRED" ? attempt1 : attempt2;
  const dispatches = await Promise.all([
    rpc("dispatch_football_api_attempt", { p_attempt_id: acquiredAttempt, p_quota_scope: scope }),
    rpc("dispatch_football_api_attempt", { p_attempt_id: acquiredAttempt, p_quota_scope: scope }),
  ]);
  if (dispatches.filter((value) => value === "DISPATCHED").length !== 1 || dispatches.filter((value) => value === "ALREADY_DISPATCHED").length !== 1) throw new Error(`duplicate dispatch protection failed: ${dispatches.join(",")}`);
  const finalArgs = { p_attempt_id: acquiredAttempt, p_quota_scope: scope, p_attempted_at: attemptedAt, p_outcome: "success", p_status: 200, p_limit: 100, p_remaining: 99, p_quota_observed_at: new Date().toISOString(), p_minute_limit: 10, p_minute_remaining: 9 };
  const finalisations = await Promise.all([rpc("record_football_api_attempt", finalArgs), rpc("record_football_api_attempt", finalArgs)]);
  if (finalisations.filter(Boolean).length !== 1) throw new Error(`idempotent finalisation failed: ${finalisations.join(",")}`);
  console.log("Phase 1D concurrent lease and quota lifecycle checks passed");
} finally {
  await db.from("football_provider_cache").delete().eq("cache_key", cacheKey);
  await db.from("football_cache_leases").delete().eq("cache_key", cacheKey);
  await db.from("football_api_attempts").delete().eq("quota_scope", scope);
}
