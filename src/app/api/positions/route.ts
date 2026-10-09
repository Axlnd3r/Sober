import { NextRequest } from "next/server";
import { mode } from "@/lib/config";
import { requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { panta, positionsSchema } from "@/lib/panta";
import { dbPool } from "@/lib/db";
export async function GET(req: NextRequest) {
  try {
    if (mode !== "live") return ok({ wallet: null, positions: [], demo: true });
    const user = await requireSession(req);
    const [result, mapped] = await Promise.all([
      panta(`/positions/?wallet=${encodeURIComponent(user.wallet)}`, positionsSchema),
      dbPool().query("SELECT panta_market_id FROM rooms WHERE panta_market_id IS NOT NULL"),
    ]);
    const footballMarkets = new Set(mapped.rows.map(row => String(row.panta_market_id)));
    return ok({ ...result, positions: result.positions.filter(position => footballMarkets.has(position.marketId)) });
  } catch (error) { return fail(error); }
}
