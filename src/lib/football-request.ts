import { parseProviderEnvelope } from "@/lib/football-provider-contract";
import type { DispatchResult, QuotaReservationResult } from "@/lib/football-persistence";
import { syntheticProviderPolicy, verifySyntheticDispatch, verifySyntheticResponse } from "@/lib/football-synthetic-provider";

export type RequestOutcome = "success" | "http_error" | "provider_error" | "network_error" | "timeout";
export type RequestCacheEntry = { response: unknown[]; stale: boolean; staleUntil: string; updatedAt?: string | null };
export type RequestFreshness = { state: "fresh" | "stale"; source: "provider" | "persistent-cache"; updatedAt: string | null; staleUntil: string | null };
export type Lease = { ownerToken: string; leaseExpiresAt: string };

export type FootballRequestDependencies = {
  fetch: typeof fetch;
  readCache: (key: string, allowStale?: boolean) => Promise<RequestCacheEntry | null>;
  writeCache: (key: string, payload: unknown[], ttlSeconds: number, staleSeconds: number, ownerToken?: string) => Promise<void>;
  acquireLease?: (key: string, ownerToken: string, leaseSeconds: number) => Promise<boolean>;
  releaseLease?: (key: string, ownerToken: string) => Promise<void>;
  reserveQuota?: (attemptId: string, attemptedAt: string, essential: boolean) => Promise<QuotaReservationResult>;
  markDispatched?: (attemptId: string) => Promise<DispatchResult>;
  recordAttempt: (attemptId: string, attemptedAt: string) => void;
  recordOutcome: (outcome: RequestOutcome, status: number | null, headers: Headers | undefined, attemptId: string, attemptedAt: string) => void | Promise<void>;
  diagnostic?: (name: "cache_hit" | "stale" | "deduplicated" | "lease_contention") => void;
  sleep?: (milliseconds: number) => Promise<void>;
  log?: Pick<Console, "warn" | "error">;
};

export type FootballRequest = {
  url: URL;
  apiKey: string;
  pathname: string;
  params: Record<string, string | number | undefined>;
  cacheKey: string;
  persistence: boolean;
  ttlSeconds: number;
  staleSeconds: number;
  essential?: boolean;
  leaseSeconds?: number;
  waitMilliseconds?: number;
  pollMilliseconds?: number;
  cooldownMilliseconds?: number;
  validateResponse?: (response: unknown) => response is unknown[];
  onFreshness?: (freshness: RequestFreshness) => void;
};

function timeoutError(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function safeFailure(error: unknown) {
  return { type: error instanceof Error ? error.name : "ExternalServiceError" };
}

export function createFootballRequester(deps: FootballRequestDependencies) {
  const inFlight = new Map<string, Promise<unknown[]>>();
  const inFlightFreshness = new Map<string, RequestFreshness>();
  let quotaCooldownUntil = 0;
  const unsupportedUntil = new Map<string, number>();

  async function undeduplicated<T>(request: FootballRequest): Promise<T[]> {
    const log = deps.log ?? console;
    if (request.persistence) {
      try {
        const cached = await deps.readCache(request.cacheKey);
        if (cached) {
          deps.diagnostic?.("cache_hit");
          request.onFreshness?.({ state: "fresh", source: "persistent-cache", updatedAt: cached.updatedAt ?? null, staleUntil: cached.staleUntil });
          return cached.response as T[];
        }
      } catch (error) {
        log.error("Persistent football cache read failed", safeFailure(error));
      }
    }

    if ((unsupportedUntil.get(request.cacheKey) ?? 0) > Date.now()) {
      const stale = request.persistence ? await deps.readCache(request.cacheKey, true) : null;
      if (stale) {
        deps.diagnostic?.("stale");
        request.onFreshness?.({ state: "stale", source: "persistent-cache", updatedAt: stale.updatedAt ?? null, staleUntil: stale.staleUntil });
        return stale.response as T[];
      }
      throw new Error("This API-Football request is temporarily suppressed after a documented plan restriction.");
    }

    let leaseOwner: string | undefined;
    if (request.persistence && deps.acquireLease) {
      leaseOwner = crypto.randomUUID();
      try {
        const acquired = await deps.acquireLease(request.cacheKey, leaseOwner, request.leaseSeconds ?? 20);
        if (!acquired) {
          deps.diagnostic?.("lease_contention");
          const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
          const deadline = Date.now() + (request.waitMilliseconds ?? 2500);
          const poll = Math.max(50, request.pollMilliseconds ?? 200);
          while (Date.now() < deadline) {
            await sleep(Math.min(poll, Math.max(0, deadline - Date.now())));
            const shared = await deps.readCache(request.cacheKey);
            if (shared) {
              deps.diagnostic?.("deduplicated");
              request.onFreshness?.({ state: "fresh", source: "persistent-cache", updatedAt: shared.updatedAt ?? null, staleUntil: shared.staleUntil });
              return shared.response as T[];
            }
          }
          const stale = await deps.readCache(request.cacheKey, true);
          if (stale) {
            deps.diagnostic?.("stale");
            request.onFreshness?.({ state: "stale", source: "persistent-cache", updatedAt: stale.updatedAt ?? null, staleUntil: stale.staleUntil });
            return stale.response as T[];
          }
          leaseOwner = undefined;
        } else {
          const shared = await deps.readCache(request.cacheKey);
          if (shared) {
            deps.diagnostic?.("cache_hit");
            request.onFreshness?.({ state: "fresh", source: "persistent-cache", updatedAt: shared.updatedAt ?? null, staleUntil: shared.staleUntil });
            await deps.releaseLease?.(request.cacheKey, leaseOwner);
            return shared.response as T[];
          }
        }
      } catch (error) {
        leaseOwner = undefined;
        log.error("Distributed football cache coordination failed; using local fallback", safeFailure(error));
      }
    }

    if (quotaCooldownUntil > Date.now()) {
      const stale = request.persistence ? await deps.readCache(request.cacheKey, true) : null;
      if (stale) {
        deps.diagnostic?.("stale");
        request.onFreshness?.({ state: "stale", source: "persistent-cache", updatedAt: stale.updatedAt ?? null, staleUntil: stale.staleUntil });
        if (leaseOwner) await deps.releaseLease?.(request.cacheKey, leaseOwner);
        return stale.response as T[];
      }
      if (leaseOwner) await deps.releaseLease?.(request.cacheKey, leaseOwner);
      throw new Error("Football data is temporarily unavailable while the provider quota resets.");
    }
    const attemptId = crypto.randomUUID();
    const attemptedAt = new Date().toISOString();
    if (deps.reserveQuota) {
      const reservation = await deps.reserveQuota(attemptId, attemptedAt, request.essential ?? false);
      if (!["ACQUIRED", "ALREADY_RESERVED", "DEGRADED"].includes(reservation)) {
        if (leaseOwner) await deps.releaseLease?.(request.cacheKey, leaseOwner);
        throw new Error("Football data is temporarily unavailable while the provider quota resets.");
      }
      if (reservation !== "DEGRADED" && deps.markDispatched) {
        const dispatch = await deps.markDispatched(attemptId);
        if (dispatch !== "DISPATCHED") {
          if (leaseOwner) await deps.releaseLease?.(request.cacheKey, leaseOwner);
          throw new Error("Football request dispatch could not be authorised safely.");
        }
      }
    }
    let response: Response | undefined;
    let outcome: RequestOutcome | undefined;
    deps.recordAttempt(attemptId, attemptedAt);
    try {
      const syntheticPolicy = syntheticProviderPolicy();
      verifySyntheticDispatch(request.url, request.apiKey, syntheticPolicy);
      response = await deps.fetch(request.url, {
        headers: { "x-apisports-key": request.apiKey },
        ...(request.persistence ? { cache: "no-store" as const } : { next: { revalidate: request.ttlSeconds } }),
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
      });
      verifySyntheticResponse(response, syntheticPolicy);
      if (!response.ok) {
        outcome = "http_error";
        if (response.status === 429) quotaCooldownUntil = Date.now() + (request.cooldownMilliseconds ?? 300_000);
        throw new Error(`API-Football request failed: endpoint=${request.pathname} status=${response.status} params=${JSON.stringify(request.params)}`);
      }
      let raw: unknown;
      try {
        raw = await response.json();
      } catch (error) {
        outcome = "provider_error";
        throw new Error(`API-Football returned invalid JSON for ${request.pathname}`, { cause: error });
      }
      let data;
      try {
        data = parseProviderEnvelope<T[]>(raw, (value): value is T[] =>
          (request.validateResponse?.(value) ?? Array.isArray(value)));
      } catch (error) {
        outcome = "provider_error";
        const message = error instanceof Error ? error.message : String(error);
        if (/plan|subscription|season|date|not available/i.test(message)) unsupportedUntil.set(request.cacheKey, Date.now() + 900_000);
        throw new Error(`${message} (endpoint=${request.pathname})`, { cause: error });
      }
      outcome = "success";
      request.onFreshness?.({ state: "fresh", source: "provider", updatedAt: new Date().toISOString(), staleUntil: null });
      if (request.persistence) {
        try { await deps.writeCache(request.cacheKey, data.response, request.ttlSeconds, request.staleSeconds, leaseOwner); }
        catch (error) { log.error("Persistent football cache write failed", safeFailure(error)); }
      }
      return data.response;
    } catch (error) {
      if (!outcome) outcome = timeoutError(error) ? "timeout" : "network_error";
      if (request.persistence) {
        try {
          const cached = await deps.readCache(request.cacheKey, true);
          if (cached?.stale) {
            log.warn("Serving stale football provider data after provider failure", {
              pathname: request.pathname, staleUntil: cached.staleUntil, outcome,
            });
            deps.diagnostic?.("stale");
            request.onFreshness?.({ state: "stale", source: "persistent-cache", updatedAt: cached.updatedAt ?? null, staleUntil: cached.staleUntil });
            return cached.response as T[];
          }
        } catch (cacheError) {
          log.error("Persistent football stale fallback failed", safeFailure(cacheError));
        }
      }
      throw error;
    } finally {
      await deps.recordOutcome(outcome ?? "network_error", response?.status ?? null, response?.headers, attemptId, attemptedAt);
      if (leaseOwner && deps.releaseLease) {
        try { await deps.releaseLease(request.cacheKey, leaseOwner); }
        catch (error) { log.error("Distributed football cache lease release failed", safeFailure(error)); }
      }
    }
  }

  return async function request<T>(options: FootballRequest): Promise<T[]> {
    const existing = inFlight.get(options.cacheKey);
    if (existing) {
      deps.diagnostic?.("deduplicated");
      const result = await existing as T[];
      const freshness = inFlightFreshness.get(options.cacheKey);
      if (freshness) options.onFreshness?.(freshness);
      return result;
    }
    const originalFreshness = options.onFreshness;
    const pending = undeduplicated<T>({
      ...options,
      onFreshness: (freshness) => {
        inFlightFreshness.set(options.cacheKey, freshness);
        originalFreshness?.(freshness);
      },
    });
    inFlight.set(options.cacheKey, pending);
    try { return await pending; }
    finally {
      if (inFlight.get(options.cacheKey) === pending) {
        inFlight.delete(options.cacheKey);
        const cleanup = setTimeout(() => inFlightFreshness.delete(options.cacheKey), 0);
        cleanup.unref?.();
      }
    }
  };
}
