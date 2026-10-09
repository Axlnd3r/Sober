import { NextRequest } from "next/server";
import { z } from "zod";
import { dbPool } from "@/lib/db";
import { mode } from "@/lib/config";
import { requireSession } from "@/lib/auth";
import { fail, ok, sameOrigin } from "@/lib/http";
import { getRoom, getRoomMarket } from "@/lib/rooms";
import { captureDecision } from "@/lib/forecast-receipt";

export async function GET(req: NextRequest) {
  try {
    const roomId = z.string().max(100).parse(req.nextUrl.searchParams.get("roomId"));
    const room = await getRoom(roomId);
    if (!room) return Response.json({ ok: false, error: { message: "Room unavailable" } }, { status: 404 });
    if (mode === "simulation") return ok({ yes: 0, no: 0, reasons: [], mine: null, demo: true });
    const current = await requireSession(req).catch(() => null);
    const [counts, recent, mine] = await Promise.all([
      dbPool().query("SELECT side,count(*)::int AS total FROM fan_forecasts WHERE room_id=$1 GROUP BY side", [roomId]),
      dbPool().query("SELECT side,reason,created_at,updated_at,wallet FROM fan_forecasts WHERE room_id=$1 ORDER BY updated_at DESC LIMIT 100", [roomId]),
      current ? dbPool().query("SELECT side,reason,analysis_id,created_at,updated_at,decision_snapshot FROM fan_forecasts WHERE room_id=$1 AND wallet=$2", [roomId, current.wallet]) : Promise.resolve(null),
    ]);
    return ok({
      yes: counts.rows.find(x => x.side === "yes")?.total || 0,
      no: counts.rows.find(x => x.side === "no")?.total || 0,
      reasons: recent.rows.map(x => ({ side: x.side, reason: x.reason, createdAt: x.created_at, updatedAt: x.updated_at, alias: `${String(x.wallet).slice(0, 4)}…${String(x.wallet).slice(-4)}` })),
      mine: mine?.rows[0] || null,
      demo: false,
    });
  } catch (error) { return fail(error); }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (mode !== "live") throw new Error("Forecasts in demo mode stay in this browser");
    const user = await requireSession(req);
    const input = z.object({ roomId: z.string().max(100), side: z.enum(["yes", "no"]), reason: z.string().trim().min(3).max(280), analysisId: z.string().uuid().nullable().optional() }).parse(await req.json());
    const room = await getRoom(input.roomId);
    if (!room) throw new Error("Room unavailable");
    if (Date.now() >= Date.parse(room.cutoffAt)) throw new Error("Forecast cutoff has passed");
    if (input.analysisId) {
      const analysis = await dbPool().query("SELECT 1 FROM match_analyses WHERE id=$1 AND room_id=$2", [input.analysisId, room.id]);
      if (!analysis.rowCount) throw new Error("Analysis does not belong to this room");
    }
    const market = await getRoomMarket(room).catch(() => null);
    const snapshot = captureDecision(room, market);
    const result = await dbPool().query(`INSERT INTO fan_forecasts(wallet,room_id,side,reason,analysis_id,decision_snapshot)
      SELECT $1,$2,$3,$4,$5,$6::jsonb WHERE now() < (SELECT cutoff_at FROM rooms WHERE id=$2 AND published=true AND reviewed=true)
      ON CONFLICT(wallet,room_id) DO UPDATE SET side=EXCLUDED.side,reason=EXCLUDED.reason,analysis_id=EXCLUDED.analysis_id,
        decision_snapshot=jsonb_set(EXCLUDED.decision_snapshot, '{cutoffAt}', to_jsonb(LEAST(
          (EXCLUDED.decision_snapshot->>'cutoffAt')::timestamptz,
          COALESCE((fan_forecasts.decision_snapshot->>'cutoffAt')::timestamptz, (EXCLUDED.decision_snapshot->>'cutoffAt')::timestamptz)
        ))), updated_at=now()
      WHERE now() < LEAST((SELECT cutoff_at FROM rooms WHERE id=$2 AND published=true AND reviewed=true),
        COALESCE((fan_forecasts.decision_snapshot->>'cutoffAt')::timestamptz, (SELECT cutoff_at FROM rooms WHERE id=$2)))
      RETURNING side,reason,analysis_id,created_at,updated_at,decision_snapshot`, [user.wallet, input.roomId, input.side, input.reason, input.analysisId ?? null, JSON.stringify(snapshot)]);
    if (!result.rowCount) throw new Error("Forecast cutoff has passed");
    return ok({ ...result.rows[0], message: "Prediction saved, no trade placed" });
  } catch (error) { return fail(error); }
}
