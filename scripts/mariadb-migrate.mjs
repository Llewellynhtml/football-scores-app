import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { requireIsolatedLocalMariaDb } from "./lib/mariadb-local-guard.mjs";
import { classifyMigration, migrationChecksum, validateMigrationHistory } from "./lib/mariadb-migrations.mjs";

requireIsolatedLocalMariaDb("migration");

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, timezone: "Z", multipleStatements: true,
});
try {
  await connection.query("SET SESSION time_zone='+00:00'");
  await connection.query("SET SESSION sql_mode=CONCAT_WS(',',NULLIF(@@SESSION.sql_mode,''),'STRICT_TRANS_TABLES')");
  const directory = resolve("mariadb/migrations");
  const files = (await readdir(directory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  const [databaseTables] = await connection.execute(
    "SELECT TABLE_NAME tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
  );
  let migrationTableExists = databaseTables.some((table) => table.tableName === "schema_migrations");
  const [history] = migrationTableExists
    ? await connection.execute("SELECT version,checksum_sha256 FROM schema_migrations ORDER BY version")
    : [[]];
  validateMigrationHistory({
    files, records: history, existingTables: databaseTables.map((table) => table.tableName), migrationTableExists,
  });
  for (const file of files) {
    const sql = await readFile(resolve(directory, file), "utf8");
    const checksum = migrationChecksum(sql);
    if (migrationTableExists) {
      const [rows] = await connection.execute("SELECT checksum_sha256 FROM schema_migrations WHERE version=?", [file]);
      if (classifyMigration(rows[0]?.checksum_sha256, checksum, file) === "unchanged") {
        console.log(`unchanged ${file}`);
        continue;
      }
    }
    await connection.query(sql);
    migrationTableExists = true;
    await connection.execute(
      "INSERT INTO schema_migrations(version,checksum_sha256,applied_at) VALUES(?,?,UTC_TIMESTAMP(6))",
      [file, checksum],
    );
    console.log(`applied ${file}`);
  }
} finally { await connection.end(); }
