import pg from "pg";
import { Connection, PublicKey } from "@solana/web3.js";

process.loadEnvFile(".env.local");

const required = ["DATABASE_URL", "PANTA_API_KEY", "SOLANA_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC_URL", "PANTA_EXPECTED_GENESIS_HASH", "PANTA_PROGRAM_IDS", "PANTA_USDC_MINT"];
const missing = required.filter(name => !process.env[name]);
const flags = ["TRADING_ENABLED", "CREATE_ENABLED", "CLAIMS_ENABLED"];
const networkReady = process.env.APP_MODE === "live" && !missing.length && Boolean(process.env.SOLANA_NETWORK && process.env.SOLANA_NETWORK !== "unverified");
const walletArg = process.argv.indexOf("--wallet");
const wallet = walletArg >= 0 ? process.argv[walletArg + 1] : null;
if (walletArg >= 0) {
  try { if (!wallet || new PublicKey(wallet).toBase58() !== wallet) throw new Error(); }
  catch { console.error("Pass a valid public Solana address after --wallet."); process.exit(1); }
}

console.log(`Mode: ${process.env.APP_MODE === "live" ? "live" : "simulation"}`);
console.log(`Transaction features: ${flags.map(name => `${name}=${networkReady && process.env[name] === "true" ? "enabled" : "disabled"}`).join(", ")}`);
console.log(`Required configuration: ${missing.length ? `missing ${missing.join(", ")}` : "present"}`);
if (!process.env.SOLANA_NETWORK || process.env.SOLANA_NETWORK === "unverified") console.log("Solana network: unverified");

const rooms = [];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const result = await client.query("SELECT id, home_team, away_team, panta_market_id, published, reviewed, trading_paused, cutoff_at FROM rooms ORDER BY kickoff_at ASC");
  console.log(`Local rooms: ${result.rows.length}`);
  for (const room of result.rows) {
    rooms.push(room);
    const ready = room.published && room.reviewed && !room.trading_paused && new Date(room.cutoff_at).getTime() > Date.now();
    console.log(`- ${room.home_team} vs ${room.away_team}: ${room.id}; mapped=${Boolean(room.panta_market_id)}; local buy gate=${ready ? "open" : "closed"}`);
  }
} catch {
  console.log("Local rooms: database unavailable");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

if (process.env.PANTA_API_KEY) {
  const base = (process.env.PANTA_API_BASE_URL || "https://live-api.panta.market/api/v1").replace(/\/$/, "");
  try {
    async function get(path) {
      const response = await fetch(`${base}${path}`, {
        headers: { Accept: "application/json", "X-Api-Key": process.env.PANTA_API_KEY },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
    const account = await get("/account/");
    console.log(`Panta create permission: ${account.canCreateMarkets === true ? "enabled" : "disabled"}`);
    const primary = [];
    const seen = new Set();
    let cursor = null;
    let pages = 0;
    do {
      const data = await get(cursor ? `/markets/?cursor=${encodeURIComponent(cursor)}` : "/markets/");
      if (!Array.isArray(data.items)) throw new Error("invalid market list");
      primary.push(...data.items.filter(item => item.phase === "primary"));
      cursor = data.nextCursor || null;
      if (cursor && seen.has(cursor)) throw new Error("repeated catalog cursor");
      if (cursor) seen.add(cursor);
      pages++;
    } while (cursor && pages < 8);
    console.log(`Panta primary markets across ${pages} page(s): ${primary.length}`);
    for (const market of primary.filter(item => item.category === "sports" && item.title).slice(0, 12)) console.log(`- ${market.title}; market ${market.marketId}`);
    let buyRoomReady = false;
    for (const room of rooms.filter(item => item.panta_market_id)) {
      const market = await get(`/markets/${encodeURIComponent(room.panta_market_id)}/`);
      console.log(`Mapped room ${room.id}: Panta phase=${market.phase}`);
      if (market.phase === "primary" && room.published && room.reviewed && !room.trading_paused && new Date(room.cutoff_at).getTime() > Date.now()) buyRoomReady = true;
    }
    console.log(`Live buy demo: ${buyRoomReady ? "eligible mapped room found" : "no eligible mapped primary room"}`);
    if (wallet) {
      const allowlisted = (process.env.ADMIN_WALLET_ALLOWLIST || "").split(",").map(value => value.trim()).includes(wallet);
      console.log(`Wallet admin access: ${allowlisted ? "allowlisted" : "not allowlisted"}`);
      const positions = await get(`/positions/?wallet=${encodeURIComponent(wallet)}`);
      if (!Array.isArray(positions.positions)) throw new Error("invalid positions response");
      const claimable = positions.positions.filter(item => item.claimable && !item.claimed);
      console.log(`Wallet positions: ${positions.positions.length}; Panta claimable: ${claimable.length}; mapped claimable: ${claimable.filter(item => rooms.some(room => room.panta_market_id === item.marketId)).length}`);
    } else console.log("Claim demo: pass --wallet <public-address> to check eligibility without signing");
  } catch {
    console.log("Panta market list: unavailable");
    process.exitCode = 1;
  }
}

if (wallet && process.env.SOLANA_RPC_URL && process.env.PANTA_USDC_MINT) {
  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");
    const owner = new PublicKey(wallet);
    const mint = new PublicKey(process.env.PANTA_USDC_MINT);
    const [lamports, accounts] = await Promise.all([
      connection.getBalance(owner),
      connection.getParsedTokenAccountsByOwner(owner, { mint }),
    ]);
    const usdc = accounts.value.reduce((sum, account) => sum + BigInt(account.account.data.parsed.info.tokenAmount.amount), 0n);
    console.log(`Wallet funding: ${lamports / 1_000_000_000} SOL; ${Number(usdc) / 1_000_000} USDC`);
  } catch {
    console.log("Wallet funding: RPC balance check unavailable");
  }
}

console.log("Preflight is read-only. It does not request a quote, sign, broadcast, create, or claim.");
