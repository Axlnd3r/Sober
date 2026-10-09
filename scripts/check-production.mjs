import { PublicKey } from "@solana/web3.js";

const errors = [];
const warnings = [];
const required = ["DATABASE_URL", "PANTA_API_KEY", "SOLANA_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC_URL", "PANTA_EXPECTED_GENESIS_HASH", "PANTA_PROGRAM_IDS", "PANTA_USDC_MINT", "ADMIN_WALLET_ALLOWLIST"];
for (const name of required) if (!process.env[name]) errors.push(`${name} is missing`);
if (process.env.APP_MODE !== "live") errors.push("APP_MODE must be live");
if (process.env.SOLANA_NETWORK !== "mainnet-beta") errors.push("SOLANA_NETWORK must match the reviewed Panta mainnet deployment");
try {
  const origin = new URL(process.env.APP_URL || "");
  if (origin.protocol !== "https:" || origin.origin !== process.env.APP_URL) errors.push("APP_URL must be the exact public HTTPS origin");
} catch { errors.push("APP_URL must be the exact public HTTPS origin"); }
try {
  const url = new URL(process.env.DATABASE_URL || "");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) errors.push("DATABASE_URL must point to a remote PostgreSQL database");
} catch { errors.push("DATABASE_URL must be a valid PostgreSQL connection URL"); }
for (const name of ["SOLANA_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC_URL"]) {
  try { if (new URL(process.env[name] || "").protocol !== "https:") errors.push(`${name} must use HTTPS`); }
  catch { errors.push(`${name} must be a valid HTTPS URL`); }
}
for (const name of ["PANTA_EXPECTED_GENESIS_HASH", "PANTA_USDC_MINT", "ADMIN_WALLET_ALLOWLIST"]) {
  const values = (process.env[name] || "").split(",").map(x => x.trim()).filter(Boolean);
  if (name !== "ADMIN_WALLET_ALLOWLIST" && values.length !== 1) errors.push(`${name} must contain one Solana address`);
  if (name === "ADMIN_WALLET_ALLOWLIST" && values.length === 0) errors.push("ADMIN_WALLET_ALLOWLIST must contain an admin address");
  for (const value of values) {
    try { new PublicKey(value); } catch { errors.push(`${name} contains an invalid Solana address`); }
  }
}
const programIds = (process.env.PANTA_PROGRAM_IDS || "").split(",").map(x => x.trim()).filter(Boolean);
if (!programIds.length) errors.push("PANTA_PROGRAM_IDS must contain at least one verified program address");
for (const value of programIds) {
  try { new PublicKey(value); } catch { errors.push("PANTA_PROGRAM_IDS contains an invalid Solana address"); }
}
for (const name of ["TRADING_ENABLED", "CREATE_ENABLED", "CLAIMS_ENABLED"]) if (process.env[name] === "true") warnings.push(`${name} is on; confirm its wallet flow on this deployment before inviting users to transact`);
if (!process.env.JOB_SECRET) warnings.push("JOB_SECRET is absent; background reconciliation and fixture jobs cannot run");
if (!process.env.FOOTBALL_API_KEY) warnings.push("FOOTBALL_API_KEY is absent; fixture import and sync are unavailable");
if (!process.env.GROQ_API_KEY) warnings.push("GROQ_API_KEY is absent; Match Analyst generation is unavailable");

for (const error of errors) console.error(`ERROR: ${error}`);
for (const warning of warnings) console.log(`NOTE: ${warning}`);
console.log(errors.length ? `Production configuration failed: ${errors.length} issue(s)` : "Production configuration is structurally ready. Run connection and live smoke checks before sharing the URL.");
process.exitCode = errors.length ? 1 : 0;
