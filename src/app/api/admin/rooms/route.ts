import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { mode } from "@/lib/config";
import { fail, ok, sameOrigin } from "@/lib/http";
import { listRooms } from "@/lib/rooms";
import { publicHttpsUrl } from "@/lib/public-url";
export async function GET(req: NextRequest) { try { await requireAdmin(req); return ok(await listRooms(true)); } catch (error) { return fail(error); } }
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req); await requireAdmin(req);
    if (mode !== "live") throw new Error("Admin writes are unavailable in demo mode");
    const input = z.object({ competition: z.string().min(2).max(100), homeTeam: z.string().min(2).max(100), awayTeam: z.string().min(2).max(100), kickoffAt: z.iso.datetime(), fixtureSourceUrl: publicHttpsUrl, brief: z.string().max(1200), question: z.string().min(20).max(512), resolutionRule: z.string().min(40).max(2048), sources: z.array(publicHttpsUrl).min(1).max(20) }).parse(await req.json());
    const kickoff = new Date(input.kickoffAt);
    if (kickoff.getTime() < Date.now() + 10 * 60_000) throw new Error("Kickoff must be in the future");
    const id = randomUUID();
    const cutoff = new Date(kickoff.getTime() - 5 * 60_000);
    await dbPool().query("INSERT INTO rooms(id,competition,home_team,away_team,kickoff_at,fixture_source_url,brief,question,resolution_rule,sources,cutoff_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [id, input.competition, input.homeTeam, input.awayTeam, kickoff, input.fixtureSourceUrl, input.brief, input.question, input.resolutionRule, JSON.stringify(input.sources), cutoff]);
    return ok({ id, cutoffAt: cutoff.toISOString(), published: false }, 201);
  } catch (error) { return fail(error); }
}
