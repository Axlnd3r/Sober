import pg from "pg";

process.loadEnvFile(".env.local");

const required = ["DATABASE_URL", "PANTA_API_KEY", "SOLANA_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC_URL"];
const missing = required.filter(name => !process.env[name]);
if (!process.env.SOLANA_NETWORK || process.env.SOLANA_NETWORK === "unverified") missing.push("SOLANA_NETWORK");

let failed = false;
if (missing.length) {
  console.error(`Missing live configuration: ${missing.join(", ")}`);
  failed = true;
}

if (process.env.DATABASE_URL) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await client.query("SELECT to_regclass('public.rooms') AS rooms");
    if (!result.rows[0]?.rooms) throw new Error("migrations missing");
    console.log("PostgreSQL: connected; rooms migration present");
  } catch {
    console.error("PostgreSQL: connection or migration check failed");
    failed = true;
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.env.PANTA_API_KEY) {
  try {
    const base = process.env.PANTA_API_BASE_URL || "https://live-api.panta.market/api/v1";
    const response = await fetch(`${base.replace(/\/$/, "")}/account/`, {
      headers: { Accept: "application/json", "X-Api-Key": process.env.PANTA_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("account request failed");
    console.log("Panta: account endpoint accepted the API key");
  } catch {
    console.error("Panta: account check failed");
    failed = true;
  }
}

async function genesisHash(name, endpoint) {
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("RPC request failed");
    const data = await response.json();
    if (typeof data.result !== "string" || !data.result) throw new Error("RPC response invalid");
    console.log(`${name}: genesis hash retrieved`);
    return data.result;
  } catch {
    console.error(`${name}: genesis hash check failed`);
    failed = true;
    return null;
  }
}

const serverGenesis = await genesisHash("Server RPC", process.env.SOLANA_RPC_URL);
const browserGenesis = await genesisHash("Browser RPC", process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
if (serverGenesis && browserGenesis) {
  if (serverGenesis === browserGenesis) console.log("RPC endpoints: same genesis hash");
  else {
    console.error("RPC endpoints: different genesis hashes");
    failed = true;
  }
}

if (process.env.PANTA_EXPECTED_GENESIS_HASH && serverGenesis && browserGenesis) {
  if (serverGenesis !== process.env.PANTA_EXPECTED_GENESIS_HASH || browserGenesis !== process.env.PANTA_EXPECTED_GENESIS_HASH) {
    console.error("RPC network does not match the expected Panta genesis hash"); failed = true;
  } else console.log("RPC endpoints: match the configured Panta genesis hash");
}
if (!failed) console.log("Connections verified. Wallet signing, instruction semantics and live trade confirmation still require validation before enabling transactions.");
process.exitCode = failed ? 1 : 0;
