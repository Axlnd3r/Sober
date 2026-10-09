import "server-only";
import { randomUUID } from "node:crypto";
import { dbPool } from "./db";
import { mode, rpcUrl } from "./config";
import { orderStatus, submitOrder } from "./order";
import { claimStatus } from "./claim";
import { registerCreate } from "./create-market";

export async function reconcilePending() {
  if (mode !== "live" || !rpcUrl || !process.env.PANTA_API_KEY) throw new Error("Reconciliation is not configured");
  const token = randomUUID();
  const lease = await dbPool().query(`
    INSERT INTO job_leases(name,token,expires_at) VALUES('reconcile',$1,now()+interval '5 minutes')
    ON CONFLICT(name) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at
    WHERE job_leases.expires_at < now() RETURNING token`, [token]);
  if (!lease.rowCount) return { busy: true, checked: 0, results: [] };

  try {
    await dbPool().query(`UPDATE intents SET state='expired_before_broadcast',updated_at=now()
      WHERE signature IS NULL AND state IN ('quoted','built')
      AND COALESCE((quote->>'expiresAt')::timestamptz,(quote->'response'->>'expiresAt')::timestamptz) < now()`);
    const batch = await dbPool().query(`SELECT id,wallet,kind,state FROM intents
      WHERE signature IS NOT NULL AND chain_status NOT IN ('mismatch','failed')
      AND updated_at < now()-interval '10 seconds'
      AND (state IN ('signed','submitted','reconciliation_required')
        OR (kind='buy' AND state='confirmed' AND attribution_status <> 'processed')
        OR (kind='claim' AND (state='confirmed' OR (state='indexed' AND attribution_status <> 'processed'))))
      ORDER BY updated_at ASC LIMIT 8`);
    const results: { intentId: string; kind: string; outcome: string }[] = [];
    for (const intent of batch.rows) {
      try {
        if (intent.kind === "buy") {
          let current = await orderStatus(intent.wallet, intent.id);
          if (current.chainStatus === "confirmed" && current.pantaStatus !== "confirmed" && intent.state === "signed") {
            await submitOrder(intent.wallet, intent.id);
            current = await orderStatus(intent.wallet, intent.id);
          }
          results.push({ intentId: intent.id, kind: intent.kind, outcome: current.state });
        } else if (intent.kind === "claim") {
          const current = await claimStatus(intent.wallet, intent.id);
          results.push({ intentId: intent.id, kind: intent.kind, outcome: current.state });
        } else if (intent.kind === "create") {
          const current = await registerCreate(intent.wallet, intent.id);
          results.push({ intentId: intent.id, kind: intent.kind, outcome: current.status });
        }
      } catch {
        results.push({ intentId: intent.id, kind: intent.kind, outcome: "still_pending_or_needs_review" });
      }
    }
    return { busy: false, checked: results.length, results };
  } finally {
    await dbPool().query("DELETE FROM job_leases WHERE name='reconcile' AND token=$1", [token]);
  }
}
