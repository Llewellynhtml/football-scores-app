import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export type CachedResponse = { response: unknown[]; stale: boolean };
type CacheRow = { payload: unknown; expires_at: string; stale_until: string };

export function persistentStoreConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function cacheKey(path: string, params: Record<string, string | number | undefined>, mode: string) {
  const sorted = Object.entries(params).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify([mode,path,sorted])).digest("hex");
}

export async function readCached(key: string, allowStale = false): Promise<CachedResponse | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client.from("football_provider_cache").select("payload,expires_at,stale_until").eq("cache_key",key).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as CacheRow;
  const now = Date.now();
  if (Date.parse(allowStale ? row.stale_until : row.expires_at) <= now) return null;
  if (!Array.isArray(row.payload)) return null;
  return { response: row.payload, stale: Date.parse(row.expires_at) <= now };
}

export async function writeCached(key: string, payload: unknown[], ttlSeconds: number) {
  const client = db();
  if (!client) return;
  const now = Date.now();
  const { error } = await client.from("football_provider_cache").upsert({
    cache_key: key,
    payload,
    expires_at: new Date(now + ttlSeconds * 1000).toISOString(),
    stale_until: new Date(now + (ttlSeconds + Math.max(300, ttlSeconds)) * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  }, { onConflict: "cache_key" });
  if (error) throw error;
}

export async function recordDurableUsage(status: number, headers?: Headers) {
  const client = db();
  if (!client) return;
  const numberHeader = (name: string) => {
    const value = headers?.get(name);
    return value != null && /^\d+$/.test(value) ? Number(value) : null;
  };
  const { error } = await client.rpc("record_football_api_call", {
    p_status: status,
    p_limit: numberHeader("x-ratelimit-requests-limit"),
    p_remaining: numberHeader("x-ratelimit-requests-remaining"),
  });
  if (error) throw error;
}

export async function readDurableUsage() {
  const client = db();
  if (!client) return null;
  const date = new Date().toISOString().slice(0,10);
  const { data, error } = await client.from("football_api_usage_daily")
    .select("day,outbound_calls,failed_calls,provider_limit,provider_remaining,last_call_at")
    .eq("day", date).maybeSingle();
  if (error) throw error;
  return data;
}
