import { spawn, execFile } from "node:child_process";
import { createServer } from "node:net";
import { Keypair } from "@solana/web3.js";

process.loadEnvFile(".env.local");
const database = new URL(process.env.DATABASE_URL || "postgresql://missing");
if (!["127.0.0.1", "localhost"].includes(database.hostname)) throw new Error("Integration tests require a local database");
const port = 3100;
const probe = createServer();
await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", resolve); });
await new Promise(resolve => probe.close(resolve));
const admin = Keypair.fromSeed(Buffer.alloc(32, 42)).publicKey.toBase58();
const fan = Keypair.fromSeed(Buffer.alloc(32, 43)).publicKey.toBase58();
const env = { ...process.env, SOBER_TEST_SERVER: "true", APP_MODE: "live", APP_URL: `http://127.0.0.1:${port}`,
  SOBER_TEST_BASE_URL: `http://127.0.0.1:${port}`, ADMIN_WALLET_ALLOWLIST: admin, INTERNAL_TEST_WALLETS: `${admin},${fan}`,
  TRADING_ENABLED: "false", CLAIMS_ENABLED: "false", CREATE_ENABLED: "false", PANTA_API_KEY: "", GROQ_API_KEY: "",
  FOOTBALL_API_KEY: "local-fixture-test-key", FOOTBALL_API_BASE_URL: "http://127.0.0.1:3201/v4", JOB_SECRET: "local-fixture-job-test-secret" };
let app;
function stop() {
  if (!app) return Promise.resolve();
  if (!app.pid || app.exitCode !== null) return Promise.resolve();
  if (process.platform === "win32") return new Promise(resolve => execFile("taskkill", ["/pid", String(app.pid), "/t", "/f"], { windowsHide: true }, resolve));
  app.kill();
  return Promise.resolve();
}
process.on("SIGINT", () => { void stop().then(() => process.exit(130)); });
for (const file of ["tests/database-integration.mjs", "tests/fixture-sync-integration.mjs"]) {
  const suiteEnv = { ...env, FOOTBALL_API_KEY: file.includes("fixture-sync") ? env.FOOTBALL_API_KEY : "" };
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], { env: suiteEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let logs = "";
  app.stdout.on("data", chunk => { logs = (logs + chunk).slice(-6000); });
  app.stderr.on("data", chunk => { logs = (logs + chunk).slice(-6000); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (app.exitCode !== null) throw new Error(`Test app exited: ${logs}`);
      ready = await fetch(`${env.APP_URL}/api/auth/session`, { signal: AbortSignal.timeout(1500) }).then(response => response.ok).catch(() => false);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Test app did not become ready: ${logs}`);
    const test = spawn(process.execPath, ["--test", "--test-isolation=none", file], { env: suiteEnv, stdio: "inherit", windowsHide: true });
    const code = await new Promise((resolve, reject) => { test.once("error", reject); test.once("exit", resolve); });
    if (code !== 0) { process.exitCode = 1; console.error(logs); break; }
  } finally { await stop(); }
}
