import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

process.loadEnvFile(".env.local");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing from .env.local");
const url = new URL(connectionString);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("This local migration command only accepts a localhost database");

const client = new pg.Client({ connectionString });
await client.connect();
try {
  const migrations = readdirSync("db/migrations").filter(file => /^\d+_.*\.sql$/.test(file)).sort();
  for (const file of migrations) {
    const sql = readFileSync(resolve("db/migrations", file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
