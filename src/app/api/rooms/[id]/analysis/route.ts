import { NextRequest } from "next/server";
import { z } from "zod";
import { session, requireAdmin } from "@/lib/auth";
import { fail, ok, sameOrigin } from "@/lib/http";
import { getRoom } from "@/lib/rooms";
import { generateAnalysis, readAnalysis } from "@/lib/match-analysis";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, context: Context) {
  try {
    const user = await session(req).catch(() => null);
    const room = await getRoom((await context.params).id, Boolean(user?.admin));
    if (!room) return Response.json({ ok: false, error: { message: "Room not found" } }, { status: 404 });
    const snapshotId = req.nextUrl.searchParams.get("snapshot");
    return ok(await readAnalysis(room, snapshotId ? z.string().uuid().parse(snapshotId) : undefined));
  } catch (error) { return fail(error); }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    sameOrigin(req); await requireAdmin(req);
    const room = await getRoom((await context.params).id, true);
    if (!room) throw new Error("Room unavailable");
    return ok(await generateAnalysis(room));
  } catch (error) { return fail(error); }
}
