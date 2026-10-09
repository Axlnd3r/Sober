import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL in the process environment before remote migration");
const url = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must be PostgreSQL");
if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("Use npm run db:migrate for a local database");
if (!process.env.MIGRATION_HOST_CONFIRM || process.env.MIGRATION_HOST_CONFIRM !== url.hostname) {
  throw new Error("Set MIGRATION_HOST_CONFIRM to the exact remote database hostname before running migrations");
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('sober:remote-migrations'))");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const migrations = readdirSync("db/migrations").filter(file => /^\d+_.*\.sql$/.test(file)).sort();
  for (const file of migrations) {
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [file]);
    if (applied.rowCount) { console.log(`Already applied ${file}`); continue; }
    const sql = readFileSync(resolve("db/migrations", file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext('sober:remote-migrations'))").catch(() => {});
  await client.end();
}
