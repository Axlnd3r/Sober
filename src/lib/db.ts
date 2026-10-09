import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const globalPool = globalThis as typeof globalThis & { soberPool?: Pool };
export function dbPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for live writes");
  globalPool.soberPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  return globalPool.soberPool;
}
export function db() { return drizzle(dbPool()); }
