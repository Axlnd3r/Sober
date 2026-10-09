import pg from "pg";

process.loadEnvFile(".env.local");
const database = new URL(process.env.DATABASE_URL || "postgresql://missing");
if (!["localhost", "127.0.0.1"].includes(database.hostname)) throw new Error("This preparation script only accepts the local database");
const origin = new URL(process.env.APP_URL || "http://localhost:3000");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("This preparation script only reads the local app");
const id = "manual-pl-2026-10-10-arsenal-leeds";
const marketId = "9ArgG5SQf9T6QbVWEjNwpBpNkdPjNWNTNB15nkdivv15";
const title = "Will Arsenal beat Leeds United on October 10, 2026?";
const kickoff = new Date("2026-10-10T11:30:00.000Z");
const cutoff = new Date(kickoff.getTime() - 5 * 60_000);
if (Date.now() >= cutoff.getTime()) throw new Error("The reviewed fixture cutoff has passed");
const response = await fetch(new URL("/api/panta/markets", origin), { signal: AbortSignal.timeout(30000) });
const feed = await response.json();
const market = feed.data?.markets?.find(item => item.marketId === marketId);
if (!response.ok || !feed.ok || market?.title !== title || !/full-time result only/i.test(market.description || "")) {
  throw new Error("The Panta question or full-time rule changed. Review the mapping again before publishing.");
}
const source = "https://www.premierleague.com/en/news/4688862/fixture-amendments-for-premier-league-matches-in-october-and-november";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const result = await client.query(`INSERT INTO rooms(id,competition,home_team,away_team,kickoff_at,fixture_source_url,
    brief,panta_market_id,question,resolution_rule,sources,cutoff_at,published,reviewed,trading_paused)
    VALUES($1,'Premier League','Arsenal','Leeds United',$2,$3,$4,$5,$6,$7,$8,$9,true,true,true)
    ON CONFLICT(id) DO NOTHING RETURNING id`, [id, kickoff, source,
    "Arsenal host Leeds United on 10 October 2026. The Premier League schedule lists kickoff at 12:30 BST (11:30 UTC). The linked Panta question concerns the full-time result. Save your call and the reason you want to revisit after the match. Schedule and market wording checked on 9 October; team-form analysis has not been published.",
    marketId, title,
    "For this free fan forecast, YES means Arsenal win after 90 minutes plus stoppage time. NO means a draw or Leeds United win. A postponed or abandoned match remains ungraded until a completed official full-time result is available. The original forecast cutoff remains locked. Panta independently determines its market settlement; no claim eligibility is inferred from this forecast.",
    JSON.stringify([source, "https://www.premierleague.com/en/matches"]), cutoff]);
  console.log(result.rowCount ? `Published reviewed local forecast room: ${id}. Panta mapping saved; trading remains paused.` : "Reviewed room already exists; no existing content was changed.");
} finally { await client.end(); }
