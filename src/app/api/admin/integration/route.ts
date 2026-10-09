import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { getPantaCatalog } from "@/lib/panta-catalog";
import { dbPool } from "@/lib/db";
import { network, tradingEnabled, claimsEnabled, createEnabled } from "@/lib/config";
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const feed = await getPantaCatalog();
    const counts = await dbPool().query("SELECT count(*)::int AS rooms,count(*) FILTER(WHERE panta_market_id IS NOT NULL)::int AS mapped,count(*) FILTER(WHERE published AND reviewed)::int AS published FROM rooms");
    return ok({ panta: feed.status, checkedAt: feed.checkedAt, ...counts.rows[0], network,
      trading: tradingEnabled, claims: claimsEnabled, create: createEnabled,
      football: Boolean(process.env.FOOTBALL_API_KEY), ai: Boolean(process.env.GROQ_API_KEY), aiModel: process.env.AI_MODEL || "openai/gpt-oss-20b",
      schedulerSecret: Boolean(process.env.JOB_SECRET),
    });
  } catch (error) { return fail(error); }
}
