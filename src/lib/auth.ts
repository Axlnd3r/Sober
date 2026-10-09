import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { dbPool } from "./db";
import { appUrl, isAdmin } from "./config";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function validWallet(value: string) { try { return new PublicKey(value).toBase58() === value; } catch { return false; } }
export function validSignature(value: string) { try { return bs58.decode(value).length === 64; } catch { return false; } }

export async function issueNonce(wallet: string) {
  if (!validWallet(wallet)) throw new Error("Invalid wallet address");
  const id = randomUUID();
  const nonce = randomBytes(18).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const challenge = `Sign in to Sober. This does not authorize a trade.\nDomain: ${new URL(appUrl).host}\nWallet: ${wallet}\nNonce: ${nonce}\nIssued at: ${new Date().toISOString()}\nExpires at: ${expiresAt.toISOString()}`;
  await dbPool().query("INSERT INTO auth_nonces(id,wallet,challenge,expires_at) VALUES ($1,$2,$3,$4)", [id, wallet, challenge, expiresAt]);
  return { nonceId: id, message: challenge, expiresAt: expiresAt.toISOString() };
}
export async function verifyNonce(id: string, signature: string) {
  if (!validSignature(signature)) throw new Error("Invalid signature");
  const result = await dbPool().query("SELECT * FROM auth_nonces WHERE id=$1 AND consumed_at IS NULL AND expires_at > now()", [id]);
  const row = result.rows[0];
  if (!row || !validWallet(row.wallet) || !row.challenge.includes(`Domain: ${new URL(appUrl).host}\n`)) throw new Error("Challenge expired or invalid");
  const verified = nacl.sign.detached.verify(new TextEncoder().encode(row.challenge), bs58.decode(signature), new PublicKey(row.wallet).toBytes());
  if (!verified) throw new Error("Signature does not match challenge");
  const consumed = await dbPool().query("UPDATE auth_nonces SET consumed_at=now() WHERE id=$1 AND consumed_at IS NULL AND expires_at > now() RETURNING wallet", [id]);
  if (!consumed.rowCount) throw new Error("Challenge already used");
  const token = randomBytes(32).toString("base64url");
  await dbPool().query("INSERT INTO auth_sessions(token_hash,wallet,expires_at) VALUES ($1,$2,now()+interval '12 hours')", [digest(token), row.wallet]);
  (await cookies()).set("sober_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
  return { wallet: row.wallet, admin: isAdmin(row.wallet) };
}
export async function session(req?: NextRequest) {
  const token = req?.cookies.get("sober_session")?.value || (await cookies()).get("sober_session")?.value;
  if (!token) return null;
  const found = await dbPool().query("SELECT wallet,expires_at FROM auth_sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > now()", [digest(token)]);
  if (!found.rows[0]) return null;
  const wallet: string = found.rows[0].wallet;
  return { wallet, admin: isAdmin(wallet), expiresAt: found.rows[0].expires_at };
}
export async function requireSession(req: NextRequest) { const value = await session(req); if (!value) throw new Error("Unauthorized"); return value; }
export async function requireAdmin(req: NextRequest) { const value = await requireSession(req); if (!value.admin) throw new Error("Forbidden"); return value; }
export async function revokeSession() {
  const token = (await cookies()).get("sober_session")?.value;
  if (token) await dbPool().query("UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1", [digest(token)]);
  (await cookies()).delete("sober_session");
}
