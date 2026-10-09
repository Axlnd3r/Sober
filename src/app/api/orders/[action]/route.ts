import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, validSignature } from "@/lib/auth";
import { fail, ok, sameOrigin } from "@/lib/http";
import { buildOrder, markSigned, quoteOrder } from "@/lib/order";
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    sameOrigin(req);
    const user = await requireSession(req);
    const action = (await params).action;
    if (action === "quote") return ok(await quoteOrder(user.wallet, z.object({ roomId: z.string(), side: z.enum(["yes", "no"]), amountUsdc: z.string(), idempotencyKey: z.uuid() }).parse(await req.json())));
    if (action === "build") return ok(await buildOrder(user.wallet, z.object({ intentId: z.uuid() }).parse(await req.json()).intentId));
    if (action === "signed") {
      const input = z.object({ intentId: z.uuid(), signature: z.string() }).parse(await req.json());
      if (!validSignature(input.signature)) throw new Error("Invalid transaction signature");
      return ok(await markSigned(user.wallet, input.intentId, input.signature));
    }
    throw new Error("Unknown action");
  } catch (error) { return fail(error); }
}
