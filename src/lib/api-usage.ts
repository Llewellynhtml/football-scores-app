export type ApiUsageSnapshot = {
  date: string;
  outboundCalls: number;
  providerLimit: number | null;
  providerRemaining: number | null;
  lastProviderCallAt: string | null;
};

type GlobalUsage = typeof globalThis & {
  __footballApiUsage?: ApiUsageSnapshot;
};

const globalUsage = globalThis as GlobalUsage;

function initialState(): ApiUsageSnapshot {
  return {
    date: new Date().toISOString().slice(0, 10),
    outboundCalls: 0,
    providerLimit: null,
    providerRemaining: null,
    lastProviderCallAt: null,
  };
}

export function recordProviderResponse(headers: Headers) {
  const today = new Date().toISOString().slice(0, 10);
  const state = globalUsage.__footballApiUsage ?? initialState();

  if (state.date !== today) {
    Object.assign(state, initialState());
  }

  state.outboundCalls += 1;
  state.lastProviderCallAt = new Date().toISOString();

  const limit = headers.get("x-ratelimit-requests-limit");
  const remaining = headers.get("x-ratelimit-requests-remaining");

  if (limit && !Number.isNaN(Number(limit))) state.providerLimit = Number(limit);
  if (remaining && !Number.isNaN(Number(remaining))) state.providerRemaining = Number(remaining);

  globalUsage.__footballApiUsage = state;
}

export function getApiUsage(): ApiUsageSnapshot {
  const state = globalUsage.__footballApiUsage ?? initialState();
  globalUsage.__footballApiUsage = state;
  return { ...state };
}
