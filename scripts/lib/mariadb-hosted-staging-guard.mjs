const forbiddenIdentity = /(prod|production|live)/i;
function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for hosted staging`);
  return value;
}

export function requireHostedStagingMariaDb(purpose, { mutating = false } = {}) {
  if (process.env.MARIADB_HOSTED_STAGING_AUTHORISED !== "true") throw new Error(`Refusing ${purpose}: hosted staging authorisation is required`);
  if (process.env.MARIADB_HOSTED_STAGING_TARGET_APPROVED !== "true") throw new Error(`Refusing ${purpose}: the independent hosted staging target must be approved`);
  if (process.env.MARIADB_ISOLATED_DATABASE === "true") throw new Error(`Refusing ${purpose}: local and hosted staging modes are mutually exclusive`);
  if (process.env.DATABASE_PROVIDER !== "mysql") throw new Error(`Refusing ${purpose}: DATABASE_PROVIDER=mysql is required`);
  if (mutating && process.env.MARIADB_HOSTED_STAGING_MUTATION !== purpose) throw new Error(`Refusing ${purpose}: mutation must exactly authorise this operation`);

  const approvedDatabase = required("MARIADB_HOSTED_STAGING_APPROVED_DATABASE");
  const approvedUser = required("MARIADB_HOSTED_STAGING_APPROVED_USER");
  const database = required("MYSQL_DATABASE");
  const user = required("MYSQL_USER");
  const host = required("MYSQL_HOST").toLowerCase();
  if (database !== approvedDatabase) throw new Error(`Refusing ${purpose}: database does not match the independently approved target`);
  if (user !== approvedUser) throw new Error(`Refusing ${purpose}: user does not match the independently approved target`);
  if (forbiddenIdentity.test(database) || forbiddenIdentity.test(user)) throw new Error(`Refusing ${purpose}: production-like database identities are forbidden`);
  if (process.env.MARIADB_HOSTED_STAGING_CONNECTION_MODE !== "hostinger-internal-loopback" || host !== "127.0.0.1") {
    throw new Error(`Refusing ${purpose}: database host must be the explicitly approved internal 127.0.0.1 path`);
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY) {
    throw new Error(`Refusing ${purpose}: Supabase configuration must be absent`);
  }
  return { host, database, user, approvedDatabase, approvedUser };
}

export function verifyHostedStagingIdentity({ actualDatabase, actualAuthenticatedUser, approvedDatabase, approvedUser, existingTables, expectedTables }) {
  if (actualDatabase !== approvedDatabase) throw new Error("Connected database identity does not match the approved hosted staging database");
  if (actualAuthenticatedUser.split("@")[0] !== approvedUser) throw new Error("Authenticated database user does not match the approved hosted staging user");
  const expected = new Set(expectedTables);
  const actual = new Set(existingTables);
  const unexpected = existingTables.filter((table) => !expected.has(table));
  if (unexpected.length) throw new Error(`Unexpected hosted staging schema objects: ${unexpected.join(", ")}`);
  const missing = expectedTables.filter((table) => !actual.has(table));
  if (missing.length) throw new Error(`Missing hosted staging schema objects: ${missing.join(", ")}`);
  return true;
}
