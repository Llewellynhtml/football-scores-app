const realProviderHosts = new Set(["v3.football.api-sports.io", "api-football-v1.p.rapidapi.com"]);

export type SyntheticProviderPolicy = { mode: "synthetic-loopback" | "synthetic-https"; origin: string };

export function syntheticProviderPolicy(env: NodeJS.ProcessEnv = process.env): SyntheticProviderPolicy | null {
  const mode = env.API_FOOTBALL_PROVIDER_MODE?.trim();
  if (!mode) return null;
  if (mode !== "synthetic-loopback" && mode !== "synthetic-https") throw new Error("Unsupported API_FOOTBALL_PROVIDER_MODE");
  const isolatedCi = env.MARIADB_ISOLATED_DATABASE === "true";
  if (!isolatedCi && env.MARIADB_HOSTED_STAGING_AUTHORISED !== "true") throw new Error("Synthetic provider mode requires isolated-CI or hosted-staging authorisation");
  const rawBase = env.API_FOOTBALL_BASE_URL?.trim();
  const approvedOrigin = env.API_FOOTBALL_SYNTHETIC_APPROVED_ORIGIN?.trim();
  const key = env.API_FOOTBALL_KEY?.trim();
  const quotaScope = env.FOOTBALL_QUOTA_SCOPE?.trim();
  if (!rawBase || !approvedOrigin || !key || !quotaScope) throw new Error("Synthetic provider configuration is incomplete");
  const base = new URL(rawBase);
  if (base.username || base.password || base.pathname !== "/" || base.search || base.hash || base.origin !== approvedOrigin) throw new Error("Synthetic provider base URL must exactly match the independently approved origin");
  if (realProviderHosts.has(base.hostname.toLowerCase())) throw new Error("Real API-Football origins are forbidden in synthetic mode");
  if (mode === "synthetic-loopback" && (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname) || !base.port)) throw new Error("Synthetic loopback mode requires an exact HTTP loopback origin and explicit port");
  if (mode === "synthetic-https" && base.protocol !== "https:") throw new Error("Synthetic HTTPS mode requires HTTPS");
  const credentialAllowed = isolatedCi
    ? key === "integration-test-key" && (!env.API_SPORTS_KEY || env.API_SPORTS_KEY === key)
    : key.startsWith("hostinger-staging-synthetic-") && !env.API_SPORTS_KEY;
  if (!credentialAllowed) throw new Error("A dedicated synthetic provider credential is required");
  if (!(isolatedCi ? quotaScope.startsWith("mariadb-m3-") : quotaScope.startsWith("hostinger-stage-"))) throw new Error("Synthetic provider mode requires an isolated quota scope");
  return { mode, origin: base.origin };
}

export function verifySyntheticDispatch(url: URL, apiKey: string, policy: SyntheticProviderPolicy | null) {
  if (!policy) return;
  if (url.origin !== policy.origin || realProviderHosts.has(url.hostname.toLowerCase())) throw new Error("Synthetic provider dispatch target is not approved");
  if (!(apiKey === "integration-test-key" || apiKey.startsWith("hostinger-staging-synthetic-"))) throw new Error("Synthetic provider dispatch credential is not approved");
}

export function verifySyntheticResponse(response: Response, policy: SyntheticProviderPolicy | null) {
  if (!policy) return;
  if (response.status >= 300 && response.status < 400) throw new Error("Synthetic provider redirects are forbidden");
  if (response.headers.get("x-football-synthetic") !== "true") throw new Error("Synthetic provider response marker is missing");
}
