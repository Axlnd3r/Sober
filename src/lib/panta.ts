import "server-only";
import { z } from "zod";

const base = process.env.PANTA_API_BASE_URL || "https://live-api.panta.market/api/v1";
const account = z.object({ pubkey: z.string(), isSigner: z.boolean(), isWritable: z.boolean() });
const instruction = z.object({ programId: z.string(), data: z.string(), accounts: z.array(account) });
export const quoteSchema = z.object({ quoteId: z.string(), marketId: z.string(), side: z.enum(["yes", "no"]), amountUsdc: z.string(), shares: z.string(), avgPrice: z.string(), feeUsdc: z.string(), expiresAt: z.string() });
export const buildSchema = z.object({ orderId: z.string(), quoteId: z.string(), wallet: z.string(), marketId: z.string(), side: z.enum(["yes", "no"]), amountUsdc: z.string(), expectedShares: z.string(), feeUsdc: z.string(), status: z.string(), instructions: z.array(instruction).min(1), recentBlockhash: z.string(), lastValidBlockHeight: z.number().optional(), expiresAt: z.string().optional() });
export const claimBuildSchema = z.object({ wallet: z.string(), marketId: z.string(), outcome: z.string(), winningShares: z.string(), instructions: z.array(instruction).min(1), recentBlockhash: z.string(), lastValidBlockHeight: z.number().optional() });
export const positionSchema = z.object({ marketId: z.string(), side: z.string(), shares: z.string(), phase: z.string(), claimable: z.boolean(), claimed: z.boolean(), outcome: z.string().nullable().optional(), category: z.string().nullable().optional() });
export const positionsSchema = z.object({ wallet: z.string(), positions: z.array(positionSchema) });
export const marketSchema = z.object({ marketId: z.string(), title: z.string(), category: z.string(), phase: z.string(), yesPrice: z.string().nullable().optional(), noPrice: z.string().nullable().optional(), primaryYesPrice: z.string().nullable().optional(), primaryNoPrice: z.string().nullable().optional(), startTime: z.number().nullable().optional(), endTime: z.number().nullable().optional(), resolutionTime: z.number().nullable().optional() }).passthrough();

export class PantaError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: string) { super(message); }
}
export async function panta<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const key = process.env.PANTA_API_KEY;
  if (!key) throw new PantaError(503, "PANTA_NOT_CONFIGURED", "Panta API key is not configured");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json", "X-Api-Key": key },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    throw new PantaError(response.status, String(record.code || `HTTP_${response.status}`), String(record.message || record.detail || "Panta request failed"), response.headers.get("Retry-After") || undefined);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new PantaError(502, "PANTA_RESPONSE_INVALID", `Unexpected Panta response for ${path}`);
  return parsed.data;
}

export const marketListSchema = z.object({ items: z.array(marketSchema), nextCursor: z.string().nullable().optional() });
export const submitSchema = z.object({ orderId: z.string(), signature: z.string(), status: z.string() }).passthrough();
export const verifySchema = z.object({ orderId: z.string(), signature: z.string(), status: z.string() }).passthrough();
export const reportSchema = z.object({ signature: z.string(), status: z.string() }).passthrough();
export const createQuoteSchema = z.object({ createId: z.string(), expectedEventPda: z.string(), paymentUsdc: z.string().regex(/^\d+$/), expiresAt: z.string() }).passthrough();
export const createBuildSchema = z.object({ createId: z.string(), expectedEventPda: z.string(), transaction: z.string(), recentBlockhash: z.string(), lastValidBlockHeight: z.number().optional(), expiresAt: z.string().optional() }).passthrough();
export const registerSchema = z.object({ createId: z.string(), marketId: z.string(), status: z.string(), signature: z.string() }).passthrough();
