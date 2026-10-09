import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const result = await dbPool().query(`SELECT f.side,f.reason,f.analysis_id,f.created_at,f.updated_at,f.decision_snapshot,
      r.id,r.home_team,r.away_team,r.competition,r.cutoff_at,r.kickoff_at,r.published,r.reviewed
      FROM fan_forecasts f JOIN rooms r ON r.id=f.room_id
      WHERE f.wallet=$1 ORDER BY f.updated_at DESC,r.id LIMIT 101`, [session.wallet]);
    const response = ok({ entries: result.rows.slice(0, 100).map(row => ({
      roomId: row.id, homeTeam: row.home_team, awayTeam: row.away_team, competition: row.competition,
      cutoffAt: row.cutoff_at, kickoffAt: row.kickoff_at, available: row.published && row.reviewed,
      forecast: { side: row.side, reason: row.reason, analysis_id: row.analysis_id, created_at: row.created_at,
        updated_at: row.updated_at, decision_snapshot: row.decision_snapshot },
    })), truncated: result.rows.length > 100 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return fail(error); }
}
