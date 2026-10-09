import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env.local") || existsSync(".env.db.local")) {
  throw new Error("Local environment files already exist. Edit them directly; setup will not overwrite credentials.");
}

const password = randomBytes(32).toString("hex");
const example = readFileSync(".env.example", "utf8");
const appEnv = example
  .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=postgresql://sober:${password}@127.0.0.1:5433/sober`)
  .replace(/^SOLANA_RPC_URL=.*$/m, "SOLANA_RPC_URL=https://api.devnet.solana.com")
  .replace(/^NEXT_PUBLIC_SOLANA_RPC_URL=.*$/m, "NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com")
  .replace(/^SOLANA_NETWORK=.*$/m, "SOLANA_NETWORK=devnet");
const dbEnv = `POSTGRES_USER=sober\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=sober\n`;

writeFileSync(".env.db.local", dbEnv, { flag: "wx", mode: 0o600 });
writeFileSync(".env.local", appEnv, { flag: "wx", mode: 0o600 });
console.log("Created .env.local and .env.db.local with a random local database password. Transaction flags remain disabled.");
