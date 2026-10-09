import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { parseEnv } from "node:util";

const accountPath = ".panta-account.local.json";
const base = "https://live-api.panta.market/api/v1";
class SetupError extends Error {}

function save(account) {
  writeFileSync(accountPath, JSON.stringify(account, null, 2) + "\n", { mode: 0o600 });
}

async function request(path, body, token) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new SetupError(`Panta ${path} returned HTTP ${response.status}. No response credentials were printed.`);
  return response.json();
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Usage: npm run setup:panta -- your-email@example.com\nCreates a Panta account and API key. Saves credentials locally; never prints secrets.\nWithout an email argument, prompts in an interactive terminal.");
    return;
  }
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (env.PANTA_API_KEY) throw new SetupError("PANTA_API_KEY is already configured; no account or key was created.");
  let account;
  let access;
  if (existsSync(accountPath)) {
    account = JSON.parse(readFileSync(accountPath, "utf8"));
    if (account.keyAttempted && !account.secret) throw new SetupError("A previous key request may have succeeded. Review keys in the Panta account before retrying; automatic duplicate creation is disabled.");
    if (!account.secret) {
      const login = await request("/auth/token/", { email: account.email, password: account.password });
      access = login.access;
    }
  } else {
    let email = process.argv[2]?.trim();
    if (!email && process.stdin.isTTY) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try { email = (await prompt.question("Email for the new Panta account: ")).trim(); }
      finally { prompt.close(); }
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SetupError("Provide a valid account email. No external account was created.");
    account = { email, password: randomBytes(32).toString("base64url") + "aA1!", name: "Sober", keyAttempted: false };
    writeFileSync(accountPath, JSON.stringify(account, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    const registered = await request("/auth/register/", { email, password: account.password, name: account.name });
    access = registered.access;
  }

  if (!account.secret) {
    if (typeof access !== "string" || !access) throw new SetupError("Panta did not return an access token. The generated login is saved locally for recovery.");
    account.keyAttempted = true;
    save(account);
    const key = await request("/account/keys/", { env: "live", name: "Sober local", revokeOthers: false }, access);
    if (typeof key.secret !== "string" || !key.secret) throw new SetupError("Panta did not return a key. Review the account before issuing another key.");
    account.secret = key.secret;
    save(account);
  }

  if (!/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(account.secret)) throw new SetupError("Panta returned an unexpected key format. It is saved locally; inspect it before configuring the app.");

  const current = readFileSync(".env.local", "utf8");
  if (parseEnv(current).PANTA_API_KEY) throw new SetupError("PANTA_API_KEY changed during setup. The new key is saved locally; existing configuration was preserved.");
  const line = `PANTA_API_KEY=${account.secret}`;
  const updated = /^PANTA_API_KEY=.*$/m.test(current)
    ? current.replace(/^PANTA_API_KEY=.*$/m, () => line)
    : current.trimEnd() + "\n" + line + "\n";
  writeFileSync(".env.local", updated, { mode: 0o600 });
  console.log("Panta credentials saved to .panta-account.local.json and API key saved to .env.local. No transactions were enabled.");
}

main().catch(error => {
  console.error(error instanceof SetupError ? error.message : "Panta setup could not finish. Any saved credentials remain in .panta-account.local.json; no response data or secrets were printed.");
  process.exitCode = 1;
});
