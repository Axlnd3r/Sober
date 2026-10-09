import "server-only";
import { validatePantaCreate } from "./panta-network";
import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { createEnabled, rpcUrl } from "./config";
import { verifyCreateTransaction } from "./chain";
import { dbPool } from "./db";
import { getRoom } from "./rooms";
import { verifyFixtureForWrite } from "./fixture-import";
import { panta, createQuoteSchema, createBuildSchema, registerSchema } from "./panta";

export async function quoteCreate(wallet: string, input: { roomId: string; startTime: number; endTime: number; resolutionTime: number; imageUrl: string; idempotencyKey: string }) {
  if (!createEnabled) throw new Error("Market creation is not configured");
  const room = await getRoom(input.roomId, true);
  if (!room || room.pantaMarketId) throw new Error("Room is unavailable or already mapped");
  await verifyFixtureForWrite(room, true);
  if (!room.question || !room.resolutionRule || !room.sources.length) throw new Error("Review the question, rule, and public resolution sources before requesting a create fee");
  if (!(input.startTime < input.endTime && input.endTime <= input.resolutionTime && input.endTime * 1000 <= new Date(room.cutoffAt).getTime())) throw new Error("Invalid market times");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const id = randomUUID();
  const inserted = await dbPool().query("INSERT INTO intents(id,wallet,kind,room_id,idempotency_key,request_hash,state) VALUES($1,$2,'create',$3,$4,$5,'quoting') ON CONFLICT(wallet,idempotency_key) DO NOTHING RETURNING id", [id, wallet, room.id, input.idempotencyKey, hash]);
  if (!inserted.rowCount) throw new Error("Create request is already being processed");
  try {
    const draft = { wallet, question: room.question, resolutionRule: room.resolutionRule, sourcesOfTruth: room.sources, category: "sports", startTime: input.startTime, endTime: input.endTime, resolutionTime: input.resolutionTime, imageUrl: input.imageUrl, marketType: "standard", title: room.question, description: room.brief, region: "Global" };
    const quote = await panta("/markets/create/quote/", createQuoteSchema, draft);
    await dbPool().query("UPDATE intents SET state='quoted',quote=$2,updated_at=now() WHERE id=$1", [id, { response: quote, draft }]);
    return { intentId: id, quote };
  } catch (error) { await dbPool().query("UPDATE intents SET state='reconciliation_required',error_code='CREATE_QUOTE_UNCERTAIN' WHERE id=$1", [id]); throw error; }
}
export async function buildCreate(wallet: string, id: string) {
  if (!createEnabled) throw new Error("Market creation is not configured");
  const reserved = await dbPool().query("UPDATE intents SET state='building' WHERE id=$1 AND wallet=$2 AND kind='create' AND state='quoted' AND (quote->'response'->>'expiresAt')::timestamptz > now() RETURNING *", [id, wallet]);
  const intent = reserved.rows[0];
  if (!intent) throw new Error("Create quote expired or already building");
  try {
    const build = await panta("/markets/create/build/", createBuildSchema, { createId: intent.quote.response.createId, wallet });
    if (build.createId !== intent.quote.response.createId || build.expectedEventPda !== intent.quote.response.expectedEventPda) throw new Error("Create build does not match quote");
    const transaction = VersionedTransaction.deserialize(Buffer.from(build.transaction, "base64"));
    if (transaction.message.staticAccountKeys[0]?.toBase58() !== wallet) throw new Error("Create build fee payer differs from admin wallet");
    if (transaction.message.header.numRequiredSignatures !== 1) throw new Error("Create build requires unsupported additional signers");
    await validatePantaCreate(wallet, build.expectedEventPda, build.transaction);
    await dbPool().query("UPDATE intents SET state='built',build=$2,updated_at=now() WHERE id=$1", [id, build]);
    return { intentId: id, build };
  } catch (error) { await dbPool().query("UPDATE intents SET state='reconciliation_required',error_code='CREATE_BUILD_UNCERTAIN' WHERE id=$1", [id]); throw error; }
}
export async function signedCreate(wallet: string, id: string, signature: string) {
  const result = await dbPool().query("UPDATE intents SET signature=$3,state='signed',updated_at=now() WHERE id=$1 AND wallet=$2 AND kind='create' AND state IN ('built','signed') AND (signature IS NULL OR signature=$3) RETURNING id", [id, wallet, signature]);
  if (!result.rowCount) throw new Error("Create signature conflicts with intent");
  return { intentId: id, signature };
}
export async function registerCreate(wallet: string, id: string) {
  if (!rpcUrl) throw new Error("RPC is not configured");
  const row = await dbPool().query("SELECT * FROM intents WHERE id=$1 AND wallet=$2 AND kind='create'", [id, wallet]);
  const intent = row.rows[0];
  if (!intent?.signature || !intent.quote?.response?.createId) throw new Error("Signed create intent not found");
  if (!intent.build?.transaction) throw new Error("Built create transaction not found");
  const chainStatus = await verifyCreateTransaction(rpcUrl, intent.signature, intent.build.transaction);
  await dbPool().query("UPDATE intents SET chain_status=$2,updated_at=now() WHERE id=$1", [id, chainStatus]);
  if (chainStatus === "mismatch") { await dbPool().query("UPDATE intents SET state='reconciliation_required',error_code='CHAIN_MISMATCH' WHERE id=$1", [id]); throw new Error("Confirmed transaction does not match this create intent"); }
  if (chainStatus === "failed") { await dbPool().query("UPDATE intents SET state='failed',error_code='CHAIN_FAILED' WHERE id=$1", [id]); throw new Error("Create transaction failed on chain"); }
  if (chainStatus !== "confirmed") throw new Error("Create transaction is still pending");
  const result = await panta("/markets/register/", registerSchema, { createId: intent.quote.response.createId, signature: intent.signature });
  if (result.createId !== intent.quote.response.createId || result.marketId !== intent.build.expectedEventPda) throw new Error("Registered market differs from expected event");
  const client = await dbPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE rooms SET panta_market_id=$2,reviewed=false,published=false WHERE id=$1", [intent.room_id, result.marketId]);
    await client.query("UPDATE intents SET state='confirmed',chain_status='confirmed',panta_status=$2,updated_at=now() WHERE id=$1", [id, result.status]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  return { ...result, roomId: intent.room_id, reviewRequired: true };
}
