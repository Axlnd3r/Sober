import { NextRequest } from "next/server";
import { getPantaCatalog } from "@/lib/panta-catalog";
import { ok } from "@/lib/http";
export async function GET(req: NextRequest) {
  const cursor = req.nextUrl.searchParams.get("cursor") || "";
  if (cursor.length > 512) return Response.json({ ok: false, error: { message: "Invalid catalog cursor" } }, { status: 400 });
  return ok(await getPantaCatalog(cursor));
}
