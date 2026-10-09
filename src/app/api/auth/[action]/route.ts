import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, sameOrigin } from "@/lib/http";
import { issueNonce, revokeSession, session, verifyNonce } from "@/lib/auth";
import { mode } from "@/lib/config";

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    if ((await params).action !== "session") throw new Error("Unknown action");
    return ok({ session: mode === "live" ? await session(req) : null, mode });
  } catch (error) { return fail(error); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    sameOrigin(req);
    if (mode !== "live") throw new Error("Live authentication is unavailable in demo mode");
    const action = (await params).action;
    if (action === "nonce") return ok(await issueNonce(z.object({ wallet: z.string() }).parse(await req.json()).wallet));
    if (action === "verify") {
      const input = z.object({ nonceId: z.uuid(), signature: z.string() }).parse(await req.json());
      return ok(await verifyNonce(input.nonceId, input.signature));
    }
    if (action === "logout") { await revokeSession(); return ok({ loggedOut: true }); }
    throw new Error("Unknown action");
  } catch (error) { return fail(error); }
}
