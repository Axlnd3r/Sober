import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { buyEligibility, getRoom, getRoomMarket } from "@/lib/rooms";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const room = await getRoom((await params).id);
    if (!room) return Response.json({ ok: false, error: { code: "NOT_FOUND", message: "Room not found" } }, { status: 404 });
    let market = null; let marketError: string | null = null;
    try { market = await getRoomMarket(room); } catch { marketError = "Panta market data is temporarily unavailable"; }
    return ok({ room, market, marketError, buyUnavailableReason: buyEligibility(room, market), fetchedAt: new Date().toISOString() });
  } catch (error) { return fail(error); }
}
