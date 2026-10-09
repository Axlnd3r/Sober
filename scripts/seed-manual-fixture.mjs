import pg from "pg";

process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");

const id = "manual-pl-2026-10-17-everton-chelsea";
const kickoff = new Date("2026-10-17T11:30:00.000Z");
if (kickoff.getTime() <= Date.now() + 10 * 60_000) throw new Error("The manual fixture is no longer upcoming");

const fixtureSource = "https://www.premierleague.com/en/news/4688862/fixture-amendments-for-premier-league-matches-in-october-and-november";
const resultSource = "https://www.premierleague.com/en/matches/premier-league/2026-27/matchweek-7";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const result = await client.query(`INSERT INTO rooms
    (id,competition,home_team,away_team,kickoff_at,fixture_source_url,brief,question,resolution_rule,sources,cutoff_at,trading_paused)
    VALUES($1,'Premier League','Everton','Chelsea',$2,$3,$4,$5,$6,$7,$8,true)
    ON CONFLICT(id) DO NOTHING RETURNING id`, [
    id, kickoff, fixtureSource,
    "The Premier League lists Everton vs Chelsea for 17 October 2026 at 12:30 BST (11:30 UTC). This manual fixture draft needs a fresh schedule and result-source check before market creation.",
    "Will Everton beat Chelsea in regular time on 17 October 2026?",
    "Resolves YES if Everton beats Chelsea after 90 minutes plus stoppage time in the scheduled Premier League match on 17 October 2026. Resolves NO for a draw or Chelsea win. Extra time and penalty shootouts do not count. Postponement, abandonment, and void handling must be reviewed against Panta rules before publication.",
    JSON.stringify([fixtureSource, resultSource]),
    new Date(kickoff.getTime() - 5 * 60_000),
  ]);
  console.log(result.rowCount
    ? `Created unpublished, paused manual fixture draft: ${id}`
    : `Manual fixture row already exists and was not changed: ${id}`);
} finally {
  await client.end();
}
