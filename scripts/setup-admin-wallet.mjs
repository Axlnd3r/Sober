import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const walletPath = ".sober-admin-wallet.local.json";
const envPath = ".env.local";

try {
  if (!existsSync(envPath)) throw new Error("Run setup:local before creating an admin wallet");
  let wallet;
  if (existsSync(walletPath)) {
    wallet = JSON.parse(readFileSync(walletPath, "utf8"));
    const restored = Keypair.fromSecretKey(bs58.decode(wallet.secretKeyBase58));
    if (restored.publicKey.toBase58() !== wallet.publicKey) throw new Error("Existing wallet file does not match its public address");
  } else {
    const generated = Keypair.generate();
    wallet = { network: "solana", publicKey: generated.publicKey.toBase58(), secretKeyBase58: bs58.encode(generated.secretKey) };
    writeFileSync(walletPath, JSON.stringify(wallet, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  }

  const current = readFileSync(envPath, "utf8");
  const existing = (parseEnv(current).ADMIN_WALLET_ALLOWLIST || "").split(",").map(value => value.trim()).filter(Boolean);
  const allowlist = [...new Set([...existing, wallet.publicKey])].join(",");
  const updated = /^ADMIN_WALLET_ALLOWLIST=.*$/m.test(current)
    ? current.replace(/^ADMIN_WALLET_ALLOWLIST=.*$/m, () => `ADMIN_WALLET_ALLOWLIST=${allowlist}`)
    : `${current.trimEnd()}\nADMIN_WALLET_ALLOWLIST=${allowlist}\n`;
  if (updated !== current) writeFileSync(envPath, updated, { mode: 0o600 });
  console.log(`Sober admin wallet address: ${wallet.publicKey}`);
  console.log(`Private key saved locally to ${walletPath}; never printed. Admin allowlist updated.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin wallet setup failed");
  process.exitCode = 1;
}
