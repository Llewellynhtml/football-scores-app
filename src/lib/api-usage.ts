export type ApiUsageSnapshot = {
  date: string;
  providerFetchInvocations: number;
  successfulResponses: number;
  httpErrors: number;
  providerErrors: number;
  networkErrors: number;
  timeouts: number;
  providerLimit: number | null;
  providerRemaining: number | null;
  providerMinuteLimit: number | null;
  providerMinuteRemaining: number | null;
  quotaObservedAt: string | null;
  recentMinuteAttempts: number;
  lastProviderCallAt: string | null;
  cacheHits: number;
  staleResponses: number;
  deduplicatedRequests: number;
  leaseContentions: number;
  pendingUsageEvents: number;
  droppedUsageEvents: number;
};

type GlobalUsage = typeof globalThis & {
  __footballApiUsage?: ApiUsageSnapshot;
  __footballApiAttemptTimes?: number[];
};

const globalUsage = globalThis as GlobalUsage;

function initialState(): ApiUsageSnapshot {
  return {
    date: new Date().toISOString().slice(0, 10),
    providerFetchInvocations: 0,
    successfulResponses: 0,
    httpErrors: 0,
    providerErrors: 0,
    networkErrors: 0,
    timeouts: 0,
    providerLimit: null,
    providerRemaining: null,
    providerMinuteLimit: null,
    providerMinuteRemaining: null,
    quotaObservedAt: null,
    recentMinuteAttempts: 0,
    lastProviderCallAt: null,
    cacheHits: 0,
    staleResponses: 0,
    deduplicatedRequests: 0,
    leaseContentions: 0,
    pendingUsageEvents: 0,
    droppedUsageEvents: 0,
  };
}

function currentState() {
  const today = new Date().toISOString().slice(0, 10);
  const state = globalUsage.__footballApiUsage ?? initialState();

  if (state.date !== today) {
    Object.assign(state, initialState());
  }

  globalUsage.__footballApiUsage = state;
  return state;
}

export function recordProviderAttempt() {
  const state = currentState();
  const cutoff = Date.now() - 60_000;
  const times = (globalUsage.__footballApiAttemptTimes ?? []).filter((timestamp) => timestamp > cutoff);
  times.push(Date.now());
  globalUsage.__footballApiAttemptTimes = times;
  state.providerFetchInvocations += 1;
  state.recentMinuteAttempts = times.length;
  state.lastProviderCallAt = new Date().toISOString();
}

export function recordDiagnostic(name: "cacheHits" | "staleResponses" | "deduplicatedRequests" | "leaseContentions", amount = 1) {
  currentState()[name] += amount;
}

export function setUsageQueueDiagnostics(pending: number, dropped: number) {
  const state = currentState();
  state.pendingUsageEvents = pending;
  state.droppedUsageEvents = dropped;
}

export type ProviderAttemptOutcome = "success" | "http_error" | "provider_error" | "network_error" | "timeout";

export function recordProviderOutcome(outcome: ProviderAttemptOutcome, headers?: Headers, observedAt = new Date().toISOString()) {
  const state = currentState();
  if (outcome === "success") state.successfulResponses += 1;
  else if (outcome === "http_error") state.httpErrors += 1;
  else if (outcome === "provider_error") state.providerErrors += 1;
  else if (outcome === "timeout") state.timeouts += 1;
  else state.networkErrors += 1;

  const limit = headers?.get("x-ratelimit-requests-limit");
  const remaining = headers?.get("x-ratelimit-requests-remaining");
  const minuteLimit = headers?.get("x-ratelimit-limit");
  const minuteRemaining = headers?.get("x-ratelimit-remaining");

  if (!state.quotaObservedAt || observedAt >= state.quotaObservedAt) {
    if (limit && /^\d+$/.test(limit)) state.providerLimit = Number(limit);
    if (remaining && /^\d+$/.test(remaining)) state.providerRemaining = Number(remaining);
    if (minuteLimit && /^\d+$/.test(minuteLimit)) state.providerMinuteLimit = Number(minuteLimit);
    if (minuteRemaining && /^\d+$/.test(minuteRemaining)) state.providerMinuteRemaining = Number(minuteRemaining);
    if (headers) state.quotaObservedAt = observedAt;
  }

}

// Compatibility for providers that only report completed HTTP responses.
export function recordProviderResponse(headers: Headers) {
  recordProviderAttempt();
  recordProviderOutcome("success", headers);
}

export function getApiUsage(): ApiUsageSnapshot {
  const state = globalUsage.__footballApiUsage ?? initialState();
  const cutoff = Date.now() - 60_000;
  globalUsage.__footballApiAttemptTimes = (globalUsage.__footballApiAttemptTimes ?? []).filter((timestamp) => timestamp > cutoff);
  state.recentMinuteAttempts = globalUsage.__footballApiAttemptTimes.length;
  globalUsage.__footballApiUsage = state;
  return { ...state };
}
