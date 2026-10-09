import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, validSignature } from "@/lib/auth";
import { buildClaim, signedClaim } from "@/lib/claim";
import { fail, ok, sameOrigin } from "@/lib/http";
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    sameOrigin(req);
    const user = await requireSession(req);
    const action = (await params).action;
    if (action === "build") { const input = z.object({ marketId: z.string(), idempotencyKey: z.uuid() }).parse(await req.json()); return ok(await buildClaim(user.wallet, input.marketId, input.idempotencyKey)); }
    if (action === "signed") { const input = z.object({ intentId: z.uuid(), signature: z.string() }).parse(await req.json()); if (!validSignature(input.signature)) throw new Error("Invalid signature"); return ok(await signedClaim(user.wallet, input.intentId, input.signature)); }
    throw new Error("Unknown action");
  } catch (error) { return fail(error); }
}
