import "server-only";
import { randomUUID } from "node:crypto";
import { mode } from "./config";
import { dbPool } from "./db";
import { getRoom } from "./rooms";
import { refreshImportedFixture } from "./fixture-import";

export async function syncImportedFixtures() {
  if (mode !== "live" || !process.env.FOOTBALL_API_KEY) throw new Error("Football fixture sync is not configured");
  const token = randomUUID();
  const lease = await dbPool().query(`
    INSERT INTO job_leases(name,token,expires_at) VALUES('fixtures',$1,now()+interval '3 minutes')
    ON CONFLICT(name) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at
    WHERE job_leases.expires_at < now() RETURNING token`, [token]);
  if (!lease.rowCount) return { busy: true, checked: 0, results: [] };

  try {
    const batch = await dbPool().query(`SELECT id FROM rooms
      WHERE provider_fixture_id IS NOT NULL AND kickoff_at > now()-interval '2 days'
      ORDER BY fixture_synced_at ASC NULLS FIRST LIMIT 5`);
    const results: { roomId: string; outcome: string }[] = [];
    for (const row of batch.rows) {
      const room = await getRoom(row.id, true);
      if (!room) continue;
      try {
        const issue = await refreshImportedFixture(room);
        results.push({ roomId: room.id, outcome: issue || "current" });
      } catch {
        results.push({ roomId: room.id, outcome: "provider_unavailable" });
      }
    }
    return { busy: false, checked: results.length, results };
  } finally {
    await dbPool().query("DELETE FROM job_leases WHERE name='fixtures' AND token=$1", [token]);
  }
}
