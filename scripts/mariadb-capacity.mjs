import mysql from "mysql2/promise";

const capacityMb = Number(process.env.MARIADB_DATABASE_CAPACITY_MB ?? 3072);
const warningPercent = Number(process.env.MARIADB_CAPACITY_WARNING_PERCENT ?? 60);
const alertPercent = Number(process.env.MARIADB_CAPACITY_ALERT_PERCENT ?? 70);
if (!Number.isFinite(capacityMb) || capacityMb <= 0) throw new Error("MARIADB_DATABASE_CAPACITY_MB must be positive");
if (!(warningPercent > 0 && warningPercent < alertPercent && alertPercent < 100)) throw new Error("Capacity thresholds must satisfy 0 < warning < alert < 100");
const connection = await mysql.createConnection({ host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT ?? 3306), database: process.env.MYSQL_DATABASE, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, timezone: "Z", connectTimeout: 5000 });
try {
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME tableName, COALESCE(DATA_LENGTH,0) dataBytes, COALESCE(INDEX_LENGTH,0) indexBytes, COALESCE(TABLE_ROWS,0) estimatedRows
     FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY DATA_LENGTH+INDEX_LENGTH DESC`,
  );
  const usedBytes = tables.reduce((sum, row) => sum + Number(row.dataBytes) + Number(row.indexBytes), 0);
  const capacityBytes = capacityMb * 1024 * 1024;
  const usedPercent = capacityBytes ? usedBytes / capacityBytes * 100 : 0;
  const status = usedPercent >= alertPercent ? "ALERT" : usedPercent >= warningPercent ? "WARNING" : "OK";
  console.log(JSON.stringify({ status, provisionalCapacity: process.env.MARIADB_DATABASE_CAPACITY_MB === undefined, capacityMb, usedMb: usedBytes / 1024 / 1024, usedPercent, headroomPercent: 100 - usedPercent, thresholds: { warningPercent, alertPercent }, tables }, null, 2));
  if (status === "ALERT") process.exitCode = 2;
  else if (status === "WARNING") process.exitCode = 1;
} finally { await connection.end(); }
