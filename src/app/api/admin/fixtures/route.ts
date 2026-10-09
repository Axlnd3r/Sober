import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { mode } from "@/lib/config";
import { footballCompetition, footballConfigured, listFixtures } from "@/lib/football";
import { importFixture } from "@/lib/fixture-import";
import { fail, ok, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";
const day = z.iso.date();

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    if (mode !== "live") throw new Error("Fixture import requires live mode");
    const competition = footballCompetition();
    if (!footballConfigured()) return ok({ configured: false, competition, fixtures: [], message: "Add FOOTBALL_API_KEY on the server to browse real fixtures." });
    const today = new Date();
    const from = day.parse(req.nextUrl.searchParams.get("dateFrom") || today.toISOString().slice(0, 10));
    const through = new Date(today.getTime() + 21 * 86_400_000).toISOString().slice(0, 10);
    const to = day.parse(req.nextUrl.searchParams.get("dateTo") || through);
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (days < 0 || days > 31) throw new Error("Choose a date range of at most 31 days");
    const fixtures = await listFixtures(from, to);
    return ok({ configured: true, competition, fixtures, updatedAt: new Date().toISOString() });
  } catch (error) { return fail(error); }
}

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    await requireAdmin(req);
    if (mode !== "live") throw new Error("Fixture import requires live mode");
    const { providerId } = z.object({ providerId: z.number().int().positive() }).parse(await req.json());
    return ok(await importFixture(providerId), 201);
  } catch (error) { return fail(error); }
}
