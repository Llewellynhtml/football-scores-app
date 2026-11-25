import test from "node:test";
import assert from "node:assert/strict";
import { getApiUsage, recordProviderAttempt, recordProviderOutcome } from "./api-usage.ts";

test("quota headers retain their last valid values when later responses omit them", () => {
  recordProviderAttempt();
  recordProviderOutcome("success", new Headers({
    "x-ratelimit-requests-limit": "100",
    "x-ratelimit-requests-remaining": "87",
  }));
  recordProviderAttempt();
  recordProviderOutcome("network_error");
  const usage = getApiUsage();
  assert.equal(usage.providerLimit, 100);
  assert.equal(usage.providerRemaining, 87);
  assert.equal(usage.providerFetchInvocations, 2);
  assert.equal(usage.successfulResponses, 1);
  assert.equal(usage.networkErrors, 1);
});

test("older delayed quota snapshots cannot overwrite newer observations", () => {
  recordProviderOutcome("success", new Headers({
    "x-ratelimit-requests-limit": "100", "x-ratelimit-requests-remaining": "40",
    "x-ratelimit-limit": "10", "x-ratelimit-remaining": "4",
  }), "2099-01-01T00:00:02.000Z");
  recordProviderOutcome("success", new Headers({
    "x-ratelimit-requests-limit": "100", "x-ratelimit-requests-remaining": "90",
    "x-ratelimit-limit": "10", "x-ratelimit-remaining": "9",
  }), "2099-01-01T00:00:01.000Z");
  const usage = getApiUsage();
  assert.equal(usage.providerRemaining, 40);
  assert.equal(usage.providerMinuteRemaining, 4);
});
