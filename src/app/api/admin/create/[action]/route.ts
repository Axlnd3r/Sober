import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, validSignature } from "@/lib/auth";
import { buildCreate, quoteCreate, registerCreate, signedCreate } from "@/lib/create-market";
import { fail, ok, sameOrigin } from "@/lib/http";
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    sameOrigin(req); const admin = await requireAdmin(req);
    const action = (await params).action;
    if (action === "quote") { const input = z.object({ roomId: z.string(), startTime: z.number().int(), endTime: z.number().int(), resolutionTime: z.number().int(), imageUrl: z.url().startsWith("https://"), idempotencyKey: z.uuid() }).parse(await req.json()); return ok(await quoteCreate(admin.wallet, input)); }
    if (action === "build") return ok(await buildCreate(admin.wallet, z.object({ intentId: z.uuid() }).parse(await req.json()).intentId));
    if (action === "signed") { const input = z.object({ intentId: z.uuid(), signature: z.string() }).parse(await req.json()); if (!validSignature(input.signature)) throw new Error("Invalid signature"); return ok(await signedCreate(admin.wallet, input.intentId, input.signature)); }
    if (action === "register") return ok(await registerCreate(admin.wallet, z.object({ intentId: z.uuid() }).parse(await req.json()).intentId));
    throw new Error("Unknown action");
  } catch (error) { return fail(error); }
}
