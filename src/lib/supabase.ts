import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0)?.trim();
}

export function getSupabaseConfig() {
  const url = firstDefined(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  const anonKey = firstDefined(
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_KEY,
  );

  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  };
}

let client: SupabaseClient | null = null;
let serviceRoleClient: SupabaseClient | null = null;

export function getSupabaseServerClient() {
  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

export function getSupabaseServiceRoleClient() {
  const url = firstDefined(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = firstDefined(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role environment variables are not configured.");
  }
  if (!serviceRoleClient) {
    serviceRoleClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return serviceRoleClient;
}
