import "server-only";
import { validatePantaInstructions } from "./panta-network";
import { createHash, randomUUID } from "node:crypto";
import { dbPool } from "./db";
import { rpcUrl, tradingEnabled } from "./config";
import { verifyInstructionTransaction } from "./chain";
import { expectedInstructionMessage } from "./transaction-policy";
import { getRoom, getRoomMarket, buyEligibility } from "./rooms";
import { verifyFixtureForWrite } from "./fixture-import";
import { buildSchema, panta, quoteSchema, submitSchema, verifySchema, reportSchema } from "./panta";
import { parseUsdcToBaseUnits } from "./money";

const attributionId = (wallet: string) => `sober:${createHash("sha256").update(wallet).digest("hex").slice(0, 24)}`;
export async function quoteOrder(wallet: string, input: { roomId: string; side: "yes" | "no"; amountUsdc: string; idempotencyKey: string }) {
  if (!tradingEnabled) throw new Error("Trading is not configured");
  parseUsdcToBaseUnits(input.amountUsdc);
  const room = await getRoom(input.roomId);
  if (!room) throw new Error("Room unavailable");
  await verifyFixtureForWrite(room);
  const market = await getRoomMarket(room);
  const reason = buyEligibility(room, market);
  if (reason) throw new Error(reason);
  const hash = createHash("sha256").update(JSON.stringify([room.id, room.pantaMarketId, input.side, input.amountUsdc])).digest("hex");
  const id = randomUUID();
  const inserted = await dbPool().query(`INSERT INTO intents(id,wallet,kind,room_id,market_id,side,amount_usdc,idempotency_key,request_hash,state) VALUES($1,$2,'buy',$3,$4,$5,$6,$7,$8,'quoting') ON CONFLICT(wallet,idempotency_key) DO NOTHING RETURNING *`, [id, wallet, room.id, room.pantaMarketId, input.side, input.amountUsdc, input.idempotencyKey, hash]);
  if (!inserted.rowCount) {
    const existing = await dbPool().query("SELECT * FROM intents WHERE wallet=$1 AND idempotency_key=$2", [wallet, input.idempotencyKey]);
    if (existing.rows[0]?.request_hash !== hash) throw new Error("Idempotency conflict: request changed");
    if (existing.rows[0]?.state === "quoted") return { intentId: existing.rows[0].id, quote: existing.rows[0].quote };
    throw new Error("Order is already being processed. Check its status.");
  }
  try {
    const quote = await panta("/primaryorderquote/", quoteSchema, { wallet, marketId: room.pantaMarketId, side: input.side, amountUsdc: input.amountUsdc, userId: attributionId(wallet) });
    if (quote.marketId !== room.pantaMarketId || quote.side !== input.side || quote.amountUsdc !== input.amountUsdc) throw new Error("Panta quote does not match the request");
    await dbPool().query("UPDATE intents SET state='quoted',quote=$2,updated_at=now() WHERE id=$1", [id, quote]);
    return { intentId: id, quote };
  } catch (error) {
    await dbPool().query("UPDATE intents SET state='reconciliation_required',error_code='QUOTE_UNCERTAIN',updated_at=now() WHERE id=$1", [id]);
    throw error;
  }
}
export async function buildOrder(wallet: string, intentId: string) {
  if (!tradingEnabled) throw new Error("Trading is not configured");
  const reserved = await dbPool().query("UPDATE intents SET state='building',updated_at=now() WHERE id=$1 AND wallet=$2 AND kind='buy' AND state='quoted' AND (quote->>'expiresAt')::timestamptz > now() RETURNING *", [intentId, wallet]);
  const intent = reserved.rows[0];
  if (!intent) throw new Error("Quote expired or order is already building");
  let reason: string | null;
  try {
    const room = await getRoom(intent.room_id);
    if (room) await verifyFixtureForWrite(room);
    const market = room && await getRoomMarket(room);
    reason = room ? buyEligibility(room, market) : "Room unavailable";
  } catch (error) {
    await dbPool().query("UPDATE intents SET state='quoted',updated_at=now() WHERE id=$1 AND state='building'", [intentId]);
    throw error;
  }
  if (reason) { await dbPool().query("UPDATE intents SET state='rejected',error_code='ROOM_CLOSED' WHERE id=$1", [intentId]); throw new Error(reason); }
  try {
    const build = await panta("/primaryorderbuild/", buildSchema, { quoteId: intent.quote.quoteId, wallet, userId: attributionId(wallet), maxSlippageBps: 100 });
    if (build.quoteId !== intent.quote.quoteId || build.wallet !== wallet || build.marketId !== intent.market_id || build.side !== intent.side) throw new Error("Panta build binding does not match the intent");
    if (build.amountUsdc !== intent.quote.amountUsdc) throw new Error("Panta build amount differs from the approved quote");
    await validatePantaInstructions(wallet, intent.market_id, build.instructions);
    expectedInstructionMessage(wallet, build.instructions, build.recentBlockhash);
    await dbPool().query("UPDATE intents SET state='built',build=$2,updated_at=now() WHERE id=$1", [intentId, build]);
    return { intentId, build };
  } catch (error) {
    await dbPool().query("UPDATE intents SET state='reconciliation_required',error_code='BUILD_UNCERTAIN',updated_at=now() WHERE id=$1", [intentId]);
    throw error;
  }
}
export async function markSigned(wallet: string, intentId: string, signature: string) {
  const row = await dbPool().query("UPDATE intents SET signature=$3,state='signed',updated_at=now() WHERE id=$1 AND wallet=$2 AND kind='buy' AND state IN ('built','signed') AND (signature IS NULL OR signature=$3) RETURNING id,signature,state", [intentId, wallet, signature]);
  if (!row.rowCount) throw new Error("Signature conflicts with this order or another order");
  return row.rows[0];
}
export async function submitOrder(wallet: string, intentId: string) {
  const rows = await dbPool().query("SELECT * FROM intents WHERE id=$1 AND wallet=$2 AND kind='buy'", [intentId, wallet]);
  const intent = rows.rows[0];
  if (!intent?.signature || !intent.build?.orderId) throw new Error("Signed order not found");
  const result = await panta("/primaryordersubmit/", submitSchema, { orderId: intent.build.orderId, signature: intent.signature, wallet });
  await dbPool().query("UPDATE intents SET state='submitted',panta_status=$2,updated_at=now() WHERE id=$1", [intentId, result.status]);
  return { intentId, signature: intent.signature, pantaStatus: result.status, chainStatus: intent.chain_status };
}
export async function orderStatus(wallet: string, intentId: string) {
  const rows = await dbPool().query("SELECT * FROM intents WHERE id=$1 AND wallet=$2 AND kind='buy'", [intentId, wallet]);
  const intent = rows.rows[0];
  if (!intent) throw new Error("Order not found");
  let chainStatus = intent.chain_status as string;
  let pantaStatus = intent.panta_status as string;
  let attributionStatus = intent.attribution_status as string;
  if (intent.signature && rpcUrl) {
    chainStatus = await verifyInstructionTransaction(rpcUrl, intent.signature, wallet, intent.build);
  }
  if (intent.signature && intent.build?.orderId && chainStatus === "confirmed") {
    try {
      const verified = await panta("/primaryorderverify/", verifySchema, { orderId: intent.build.orderId, signature: intent.signature, wallet });
      pantaStatus = verified.status;
    } catch { pantaStatus = "verification_pending"; }
  }
  if (chainStatus === "confirmed" && pantaStatus === "confirmed" && attributionStatus !== "processed") {
    try {
      const report = await panta("/trades/", reportSchema, { signature: intent.signature, wallet, marketId: intent.market_id, quoteId: intent.quote?.quoteId, clientOrderId: intent.id, userId: attributionId(wallet) });
      attributionStatus = report.status;
    } catch { attributionStatus = "pending"; }
  }
  const state = chainStatus === "mismatch" ? "reconciliation_required" : chainStatus === "failed" ? "failed" : chainStatus === "confirmed" && pantaStatus === "confirmed" ? "confirmed" : intent.state;
  await dbPool().query("UPDATE intents SET state=$2,chain_status=$3,panta_status=$4,attribution_status=$5,updated_at=now() WHERE id=$1", [intentId, state, chainStatus, pantaStatus, attributionStatus]);
  return { intentId, state, signature: intent.signature, chainStatus, pantaStatus, attributionStatus, marketId: intent.market_id, side: intent.side, amountUsdc: intent.amount_usdc };
}
