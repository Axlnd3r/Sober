import { NextRequest } from "next/server";
import { requireJobSecret } from "@/lib/job-auth";
import { fail, ok } from "@/lib/http";
import { mode } from "@/lib/config";
import { listRooms } from "@/lib/rooms";
import { generateAnalysis, readAnalysis } from "@/lib/match-analysis";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  try {
    requireJobSecret(req);
    if (mode !== "live") throw new Error("Analysis jobs require live mode");
    const rooms = (await listRooms()).filter(r => r.providerFixtureId && Date.parse(r.cutoffAt) > Date.now()).sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
    for (const room of rooms) {
      const existing = await readAnalysis(room);
      if (existing.analysis && !existing.stale) continue;
      const result = await generateAnalysis(room);
      return ok({ processed: 1, roomId: room.id, engine: result.analysis?.engine });
    }
    return ok({ processed: 0 });
  } catch (error) { return fail(error); }
}
