import { NextRequest } from "next/server";
import { getFootballOverview } from "@/lib/football-overview";
import { fail, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const cursor = request.nextUrl.searchParams.get("cursor") || "";
    if (cursor.length > 512) return Response.json({ ok: false, error: "Invalid cursor" }, { status: 400 });
    return ok(await getFootballOverview(cursor));
  } catch (error) { return fail(error); }
}
