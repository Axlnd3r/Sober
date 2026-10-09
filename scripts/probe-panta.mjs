import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { Keypair } from "@solana/web3.js";
import { probePanta } from "./panta-probe-core.mjs";

const env = parseEnv(readFileSync(".env.local", "utf8"));
const key = process.env.PANTA_API_KEY || env.PANTA_API_KEY;
const base = process.env.PANTA_API_BASE_URL || env.PANTA_API_BASE_URL || "https://live-api.panta.market/api/v1";

if (!key) {
  console.error("Panta probe unavailable: add PANTA_API_KEY to .env.local. No request was sent.");
  process.exitCode = 1;
} else {
  try {
    const result = await probePanta(base, key, fetch, Keypair.generate().publicKey.toBase58());
    console.log(`Panta account: authenticated; create permission ${result.canCreateMarkets ? "enabled" : "disabled"}`);
    console.log(`Panta catalog: reachable; ${result.firstPageCount} markets on the first page; ${result.primaryCount} primary across ${result.catalogPages} checked page(s); response shape accepted`);
    if (!result.primaryFilterHonored) console.log("Panta catalog phase filter returned non-primary rows; Sober must check each returned phase locally");
    console.log(`Panta market detail: ${result.detailChecked ? "reachable; response shape accepted" : "not checked because the first page is empty"}`);
    console.log(`Panta positions: ${result.positionsChecked ? "reachable; empty-wallet response shape accepted" : "not checked"}`);
    console.log("Read-only probe passed. No quote, transaction, or wallet action was attempted.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Panta probe failed");
    process.exitCode = 1;
  }
}
