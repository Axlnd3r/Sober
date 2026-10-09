import pg from "pg";

process.loadEnvFile(".env.local");

console.log(`App mode: ${process.env.APP_MODE === "live" ? "live" : "simulation"}`);
console.log(`football-data.org import: ${process.env.FOOTBALL_API_KEY ? "configured" : "not configured"}`);
console.log("Public schedule preview: TheSportsDB free API (read only)");
console.log(`Panta API: ${process.env.PANTA_API_KEY ? "configured" : "not configured"}`);

if (!process.env.DATABASE_URL) {
  console.log("Database: not configured");
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const result = await client.query(`SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE kickoff_at > now())::int AS upcoming,
    count(*) FILTER (WHERE kickoff_at > now() AND published AND reviewed)::int AS dashboard_ready,
    count(*) FILTER (WHERE kickoff_at > now() AND NOT published)::int AS upcoming_drafts,
    count(*) FILTER (WHERE kickoff_at > now() AND panta_market_id IS NOT NULL)::int AS upcoming_panta_mapped
    FROM rooms`);
  const counts = result.rows[0];
  console.log(`Database rooms: ${counts.total} total, ${counts.upcoming} upcoming, ${counts.dashboard_ready} dashboard-ready, ${counts.upcoming_drafts} upcoming drafts, ${counts.upcoming_panta_mapped} mapped to Panta`);
} catch {
  console.error("Database: connection or rooms query failed");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
