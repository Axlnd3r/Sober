import { spawn } from "node:child_process";
import { Keypair } from "@solana/web3.js";
const fixtureMode = process.argv.includes("--fixtures");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit", env: { ...process.env, SOBER_TEST_SERVER: "true", APP_MODE: "live", APP_URL: "http://localhost:3100",
    ADMIN_WALLET_ALLOWLIST: Keypair.fromSeed(Buffer.alloc(32, 42)).publicKey.toBase58(), GROQ_API_KEY: "",
    FOOTBALL_API_KEY: fixtureMode ? "local-fixture-test-key" : "", FOOTBALL_API_BASE_URL: "http://127.0.0.1:3201/v4",
    JOB_SECRET: "local-fixture-job-test-secret", TRADING_ENABLED: "false", CREATE_ENABLED: "false", CLAIMS_ENABLED: "false" },
});
child.on("exit", code => { process.exitCode = code ?? 1; });
