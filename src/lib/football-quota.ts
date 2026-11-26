export type QuotaConfig = {
  enabled: boolean;
  dailyLimit: number;
  reserve: number;
  minuteLimit: number;
  minuteReserve: number;
  cooldownMs: number;
};

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return value;
}

export function quotaConfig(): QuotaConfig {
  const enabled = (process.env.FOOTBALL_QUOTA_GUARD_ENABLED ?? "true").trim().toLowerCase() === "true";
  const dailyLimit = integerEnv("FOOTBALL_DAILY_REQUEST_LIMIT", 100, 1, 10_000_000);
  const reserve = integerEnv("FOOTBALL_QUOTA_RESERVE", 10, 0, dailyLimit);
  const minuteLimit = integerEnv("FOOTBALL_PER_MINUTE_REQUEST_LIMIT", 10, 1, 10_000);
  const minuteReserve = integerEnv("FOOTBALL_PER_MINUTE_RESERVE", 2, 0, minuteLimit);
  const cooldownMs = integerEnv("FOOTBALL_QUOTA_COOLDOWN_SECONDS", 300, 1, 3600) * 1000;
  return { enabled, dailyLimit, reserve, minuteLimit, minuteReserve, cooldownMs };
}

export function isEssentialRequest(pathname: string, params: Record<string, string | number | undefined>) {
  return pathname === "/fixtures" && (params.live !== undefined || params.id !== undefined || params.date !== undefined);
}

export function quotaAllowsRequest(used: number, essential: boolean, config = quotaConfig(), usedLastMinute = 0) {
  if (!config.enabled) return true;
  return used < config.dailyLimit - (essential ? 0 : config.reserve)
    && usedLastMinute < config.minuteLimit - (essential ? 0 : config.minuteReserve);
}

export class FootballQuotaUnavailableError extends Error {
  constructor() {
    super("Football data is temporarily unavailable while the provider quota resets.");
    this.name = "FootballQuotaUnavailableError";
  }
}
