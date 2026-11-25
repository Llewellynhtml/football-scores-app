export type ProviderPaging = { current: number; total: number };
export type ProviderEnvelope<T> = {
  get: string | null;
  parameters: Record<string, string>;
  errors: unknown;
  results: number;
  paging: ProviderPaging | null;
  response: T;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function providerErrorDetail(errors: unknown) {
  if (!errors) return null;
  if (Array.isArray(errors) && errors.length === 0) return null;
  if (isRecord(errors) && Object.keys(errors).length === 0) return null;
  if (typeof errors === "string" && errors.trim() === "") return null;
  try { return typeof errors === "string" ? errors : JSON.stringify(errors); }
  catch { return String(errors); }
}

export function parseProviderEnvelope<T>(value: unknown, validateResponse: (response: unknown) => response is T): ProviderEnvelope<T> {
  if (!isRecord(value)) throw new Error("API-Football returned an invalid response envelope");
  const providerError = providerErrorDetail(value.errors);
  if (providerError) throw new Error(`API-Football provider error: ${providerError}`);
  const response = value.response ?? (value.results === 0 ? [] : undefined);
  if (!validateResponse(response)) throw new Error("API-Football returned an invalid response payload");
  const paging = isRecord(value.paging)
    && Number.isInteger(value.paging.current) && Number.isInteger(value.paging.total)
    ? { current: Number(value.paging.current), total: Number(value.paging.total) }
    : null;
  return {
    get: typeof value.get === "string" ? value.get : null,
    parameters: isRecord(value.parameters)
      ? Object.fromEntries(Object.entries(value.parameters).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {},
    errors: value.errors ?? [],
    results: Number.isInteger(value.results) && Number(value.results) >= 0 ? Number(value.results) : Array.isArray(response) ? response.length : 1,
    paging,
    response,
  };
}

export const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isRecord);

export function rateLimitHeaders(headers?: Headers) {
  const parse = (name: string) => {
    const raw = headers?.get(name);
    return raw != null && /^\d+$/.test(raw) ? Number(raw) : null;
  };
  return {
    dailyLimit: parse("x-ratelimit-requests-limit"),
    dailyRemaining: parse("x-ratelimit-requests-remaining"),
    minuteLimit: parse("x-ratelimit-limit"),
    minuteRemaining: parse("x-ratelimit-remaining"),
  };
}
