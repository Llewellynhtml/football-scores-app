import { createHash } from "node:crypto";

export function migrationChecksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export function classifyMigration(existingChecksum, expectedChecksum, version) {
  if (existingChecksum == null) return "apply";
  if (existingChecksum !== expectedChecksum) throw new Error(`Applied migration checksum changed: ${version}`);
  return "unchanged";
}

export function validateMigrationHistory({ files, records, existingTables, migrationTableExists }) {
  if (!migrationTableExists) {
    if (existingTables.length) throw new Error("Invalid migration history: non-empty database has no schema_migrations table");
    return;
  }
  const versions = records.map((record) => record.version);
  const unknown = versions.filter((version) => !files.includes(version));
  if (unknown.length) throw new Error(`Invalid migration history: unknown versions: ${unknown.join(", ")}`);
  const expectedPrefix = files.slice(0, versions.length);
  if (versions.length > files.length || versions.some((version, index) => version !== expectedPrefix[index])) {
    throw new Error("Invalid migration history: applied migrations are not an ordered prefix");
  }
  for (const record of records) {
    if (!/^[a-f0-9]{64}$/.test(record.checksum_sha256)) {
      throw new Error(`Invalid migration history: malformed checksum for ${record.version}`);
    }
  }
}
