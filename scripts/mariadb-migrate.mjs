import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { requireIsolatedLocalMariaDb } from "./lib/mariadb-local-guard.mjs";

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
  for (const file of files) {
    const sql = await readFile(resolve(directory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (file !== "001_schema_migrations.sql") {
      const [rows] = await connection.execute("SELECT checksum_sha256 FROM schema_migrations WHERE version=?", [file]);
      if (rows[0]) {
        if (rows[0].checksum_sha256 !== checksum) throw new Error(`Applied migration checksum changed: ${file}`);
        console.log(`unchanged ${file}`);
        continue;
      }
    }
    await connection.query(sql);
    await connection.execute(
      "INSERT INTO schema_migrations(version,checksum_sha256,applied_at) VALUES(?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE checksum_sha256=VALUES(checksum_sha256)",
      [file, checksum],
    );
    console.log(`applied ${file}`);
  }
} finally { await connection.end(); }
