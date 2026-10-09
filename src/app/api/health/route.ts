import { mode } from "@/lib/config";
import { dbPool } from "@/lib/db";

export async function GET() {
  let database = mode === "simulation" ? "not_required" : "unavailable";
  if (mode === "live") {
    try { await dbPool().query("SELECT 1"); database = "connected"; }
    catch { database = "unavailable"; }
  }
  const ready = database !== "unavailable";
  return Response.json({ status: ready ? "ready" : "degraded", mode, database }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
