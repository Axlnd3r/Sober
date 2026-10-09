import { spawn } from "node:child_process";

const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3001"], {
  env: { ...process.env, APP_MODE: "simulation", APP_URL: "http://127.0.0.1:3001", SOBER_DEMO_SERVER: "true",
    TRADING_ENABLED: "false", CLAIMS_ENABLED: "false", CREATE_ENABLED: "false" },
  stdio: "inherit", windowsHide: true,
});
process.on("SIGINT", () => { app.kill(); process.exit(0); });
process.on("SIGTERM", () => { app.kill(); process.exit(0); });
app.once("exit", code => { process.exitCode = code || 0; });
