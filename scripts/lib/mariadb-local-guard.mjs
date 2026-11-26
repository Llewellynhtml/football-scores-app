const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function requireIsolatedLocalMariaDb(purpose) {
  const host = process.env.MYSQL_HOST?.trim().toLowerCase();
  const database = process.env.MYSQL_DATABASE?.trim();
  if (process.env.MARIADB_ISOLATED_DATABASE !== "true") throw new Error(`Refusing ${purpose}: MARIADB_ISOLATED_DATABASE=true is required`);
  if (!host || !loopbackHosts.has(host)) throw new Error(`Refusing ${purpose}: MYSQL_HOST must be 127.0.0.1, localhost, or ::1`);
  if (!database || !/^football_scores_test_[a-z0-9_]+$/i.test(database)) throw new Error(`Refusing ${purpose}: MYSQL_DATABASE must be a dedicated football_scores_test_* database`);
  for (const name of ["MYSQL_USER", "MYSQL_PASSWORD"]) if (!process.env[name]) throw new Error(`${name} is required`);
  if (process.env.DATABASE_PROVIDER !== "mysql") throw new Error(`Refusing ${purpose}: DATABASE_PROVIDER=mysql is required`);
  return { host, database };
}

export function requireLoopbackMockProvider(purpose) {
  const raw = process.env.API_FOOTBALL_BASE_URL;
  if (!raw) throw new Error(`Refusing ${purpose}: API_FOOTBALL_BASE_URL must point to the localhost mock`);
  const url = new URL(raw);
  if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname.toLowerCase())) throw new Error(`Refusing ${purpose}: API_FOOTBALL_BASE_URL must be an HTTP loopback URL`);
  if (process.env.API_FOOTBALL_KEY !== "integration-test-key" || (process.env.API_SPORTS_KEY && process.env.API_SPORTS_KEY !== "integration-test-key")) {
    throw new Error(`Refusing ${purpose}: only the integration-test-key mock credential is allowed`);
  }
  return url;
}
