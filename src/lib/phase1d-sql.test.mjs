import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const phase1b = readFileSync(new URL("../../supabase/migrations/20261124_phase1b_usage_and_cache_maintenance.sql", import.meta.url), "utf8");
const phase1c = readFileSync(new URL("../../supabase/migrations/20261124_phase1c_reliability_and_coordination.sql", import.meta.url), "utf8");

test("guarded cache writes lock and validate the lease row", () => {
  const body = phase1c.match(/create or replace function public\.write_football_cache_if_lease_owner[\s\S]*?end \$\$;/i)?.[0] ?? "";
  assert.match(body, /from public\.football_cache_leases where cache_key=p_cache_key for update/i);
  assert.match(body, /v_owner<>p_owner_token or v_expires<=clock_timestamp\(\)/i);
  assert.doesNotMatch(body, /updated_at <=/i);
});

test("quota lifecycle uses one stable scope lock for reserve, dispatch and finalise", () => {
  assert.equal((phase1c.match(/pg_advisory_xact_lock\(hashtextextended\('football_quota:'\|\|p_quota_scope,0\)\)/g) ?? []).length, 3);
  assert.doesNotMatch(phase1c, /football_quota_'\|\|\(clock_timestamp\(\) at time zone 'UTC'\)::date/i);
  assert.match(phase1c, /'RESERVED','DISPATCHED','FINALISED','UNKNOWN_OUTCOME','CANCELLED','RECONCILED'/);
});

test("both cache cleanup functions explicitly reject NULL limits", () => {
  assert.match(phase1b, /if p_limit is null or p_limit < 1 or p_limit > 5000/i);
  assert.match(phase1c, /if p_limit is null or p_limit<1 or p_limit>5000/i);
});

test("duplicate reservation and dispatch outcomes fail closed", () => {
  assert.match(phase1c, /return 'ALREADY_RESERVED'/);
  assert.match(phase1c, /return 'ALREADY_DISPATCHED'/);
  assert.match(phase1c, /return 'ALREADY_FINALISED'/);
  assert.match(phase1c, /if v_state not in \('DISPATCHED','UNKNOWN_OUTCOME'\) then return false/);
});
