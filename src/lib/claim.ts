import "server-only";
import { validatePantaInstructions } from "./panta-network";
import { createHash, randomUUID } from "node:crypto";
import { claimsEnabled, rpcUrl } from "./config";
import { verifyInstructionTransaction } from "./chain";
import { expectedInstructionMessage } from "./transaction-policy";
import { dbPool } from "./db";
import { claimBuildSchema, panta, positionsSchema, reportSchema } from "./panta";

export async function buildClaim(wallet: string, marketId: string, idempotencyKey: string) {
  if (!claimsEnabled) throw new Error("Claims are not configured");
  const mapped = await dbPool().query("SELECT 1 FROM rooms WHERE panta_market_id=$1 LIMIT 1", [marketId]);
  if (!mapped.rowCount) throw new Error("This market is not mapped to a Sober football room");
  const positions = await panta(`/positions/?wallet=${encodeURIComponent(wallet)}`, positionsSchema);
  if (!positions.positions.some(x => x.marketId === marketId && x.claimable && !x.claimed)) throw new Error("Position is not claimable according to Panta");
  const hash = createHash("sha256").update(JSON.stringify(["claim", marketId])).digest("hex");
  const id = randomUUID();
  const inserted = await dbPool().query("INSERT INTO intents(id,wallet,kind,market_id,idempotency_key,request_hash,state) VALUES($1,$2,'claim',$3,$4,$5,'building') ON CONFLICT(wallet,idempotency_key) DO NOTHING RETURNING id", [id, wallet, marketId, idempotencyKey, hash]);
  if (!inserted.rowCount) {
    const existing = await dbPool().query("SELECT * FROM intents WHERE wallet=$1 AND idempotency_key=$2", [wallet, idempotencyKey]);
    if (existing.rows[0]?.request_hash !== hash) throw new Error("Idempotency conflict: request changed");
    if (existing.rows[0]?.state === "built") return { intentId: existing.rows[0].id, build: existing.rows[0].build };
    throw new Error("Claim is already in progress");
  }
  try {
    const build = await panta("/claim/build/", claimBuildSchema, { wallet, marketId });
    if (build.wallet !== wallet || build.marketId !== marketId) throw new Error("Claim build does not match the wallet and market");
    await validatePantaInstructions(wallet, marketId, build.instructions);
    expectedInstructionMessage(wallet, build.instructions, build.recentBlockhash);
    await dbPool().query("UPDATE intents SET state='built',build=$2,updated_at=now() WHERE id=$1", [id, build]);
    return { intentId: id, build };
  } catch (error) { await dbPool().query("UPDATE intents SET state='reconciliation_required',error_code='CLAIM_BUILD_UNCERTAIN' WHERE id=$1", [id]); throw error; }
}
export async function signedClaim(wallet: string, id: string, signature: string) {
  const row = await dbPool().query("UPDATE intents SET signature=$3,state='signed',updated_at=now() WHERE id=$1 AND wallet=$2 AND kind='claim' AND state IN ('built','signed') AND (signature IS NULL OR signature=$3) RETURNING id", [id, wallet, signature]);
  if (!row.rowCount) throw new Error("Claim signature conflicts with an existing intent");
  return { intentId: id, signature };
}
export async function claimStatus(wallet: string, id: string) {
  const result = await dbPool().query("SELECT * FROM intents WHERE id=$1 AND wallet=$2 AND kind='claim'", [id, wallet]);
  const intent = result.rows[0];
  if (!intent) throw new Error("Claim not found");
  let chainStatus = intent.chain_status as string;
  let attributionStatus = intent.attribution_status as string;
  if (intent.signature && rpcUrl) {
    chainStatus = await verifyInstructionTransaction(rpcUrl, intent.signature, wallet, intent.build);
  }
  if (chainStatus === "confirmed" && attributionStatus !== "processed") {
    try {
      const report = await panta("/trades/", reportSchema, { signature: intent.signature, wallet, marketId: intent.market_id, clientOrderId: id, userId: `sober:${createHash("sha256").update(wallet).digest("hex").slice(0, 24)}` });
      attributionStatus = report.status;
    } catch { attributionStatus = "pending"; }
  }
  const positions = chainStatus === "confirmed" ? await panta(`/positions/?wallet=${encodeURIComponent(wallet)}`, positionsSchema).catch(() => null) : null;
  const indexed = positions?.positions.some(x => x.marketId === intent.market_id && x.claimed) || false;
  const state = chainStatus === "mismatch" ? "reconciliation_required" : chainStatus === "failed" ? "failed" : chainStatus === "confirmed" ? indexed ? "indexed" : "confirmed" : intent.state;
  await dbPool().query("UPDATE intents SET state=$2,chain_status=$3,attribution_status=$4,updated_at=now() WHERE id=$1", [id, state, chainStatus, attributionStatus]);
  return { intentId: id, signature: intent.signature, state, chainStatus, attributionStatus, indexed };
}
