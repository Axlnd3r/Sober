import "server-only";
import { dbPool } from "./db";
import { getFixture, importableFixture, type FootballFixture } from "./football";
import type { Room } from "./rooms";

export function fixtureReviewIssue(room: Room, fixture: FootballFixture) {
  if (fixture.status !== "TIMED") return "kickoff_not_final";
  if (fixture.kickoffAt !== room.kickoffAt) return "kickoff_changed";
  if (fixture.homeTeam !== room.homeTeam || fixture.awayTeam !== room.awayTeam || fixture.competition !== room.competition) return "fixture_identity_changed";
  return null;
}

export async function refreshImportedFixture(room: Room) {
  if (!room.providerFixtureId) return null;
  const fixture = await getFixture(room.providerFixtureId);
  const issue = fixtureReviewIssue(room, fixture);
  await dbPool().query(`UPDATE rooms SET provider_status=$2,provider_updated_at=$3,fixture_synced_at=now(),fixture_issue=$4,
    trading_paused=CASE WHEN $4::text IS NOT NULL THEN true ELSE trading_paused END WHERE id=$1`, [
    room.id, fixture.status, fixture.providerUpdatedAt ? new Date(fixture.providerUpdatedAt) : null, issue,
  ]);
  return issue;
}

export async function verifyFixtureForWrite(room: Room, force = false) {
  if (!room.providerFixtureId) return;
  if (!process.env.FOOTBALL_API_KEY) throw new Error("Football data is not configured; imported fixture writes are paused");
  if (!force && room.fixtureIssue) throw new Error("Fixture change needs host review before market actions");
  if (!force && room.providerStatus && room.providerStatus !== "TIMED") throw new Error("Fixture kickoff is not final or the match is no longer scheduled");
  if (!force && room.fixtureSyncedAt && Date.now() - new Date(room.fixtureSyncedAt).getTime() < 30_000) return;
  const issue = await refreshImportedFixture(room);
  if (issue) throw new Error("Fixture kickoff, teams, or status changed; trading is paused for host review");
}

export async function importFixture(providerId: number) {
  const fixture = await getFixture(providerId);
  if (!importableFixture(fixture)) throw new Error("Only upcoming scheduled fixtures can be imported");
  const kickoff = new Date(fixture.kickoffAt);
  const timeLabel = `${fixture.kickoffAt.slice(0, 16).replace("T", " ")} UTC`;
  const question = `Will ${fixture.homeTeam} beat ${fixture.awayTeam} in regular time in ${fixture.competition} on ${timeLabel}?`;
  const resolutionRule = `Resolves YES if ${fixture.homeTeam} beats ${fixture.awayTeam} after 90 minutes plus stoppage time in football-data.org fixture ${providerId}. Resolves NO for a draw or ${fixture.awayTeam} win. Extra time and penalty shootouts are excluded. Review the official competition result and Panta exception policy before publication.`;
  const cutoff = new Date(kickoff.getTime() - 5 * 60_000);
  const result = await dbPool().query(`
    INSERT INTO rooms (id,competition,home_team,away_team,kickoff_at,fixture_source_url,brief,question,resolution_rule,sources,cutoff_at,provider_fixture_id,provider_status,provider_updated_at,fixture_synced_at)
    VALUES ($1,$2,$3,$4,$5,$6,'',$7,$8,'[]'::jsonb,$9,$10,$11,$12,now())
    ON CONFLICT (provider_fixture_id) DO UPDATE SET
      competition=EXCLUDED.competition,home_team=EXCLUDED.home_team,away_team=EXCLUDED.away_team,
      kickoff_at=EXCLUDED.kickoff_at,fixture_source_url=EXCLUDED.fixture_source_url,
      question=EXCLUDED.question,resolution_rule=EXCLUDED.resolution_rule,cutoff_at=EXCLUDED.cutoff_at,
      provider_status=EXCLUDED.provider_status,provider_updated_at=EXCLUDED.provider_updated_at,fixture_synced_at=now()
      ,fixture_issue=NULL,trading_paused=false
    WHERE rooms.published=false AND rooms.reviewed=false AND rooms.panta_market_id IS NULL
    RETURNING id,kickoff_at`, [
    `fd-${providerId}`, fixture.competition, fixture.homeTeam, fixture.awayTeam, kickoff,
    fixture.sourceUrl, question, resolutionRule, cutoff, providerId, fixture.status,
    fixture.providerUpdatedAt ? new Date(fixture.providerUpdatedAt) : null,
  ]);
  if (!result.rowCount) throw new Error("This fixture is already reviewed, mapped, or published; review changes manually");
  await dbPool().query("UPDATE rooms SET home_team_provider_id=$2,away_team_provider_id=$3 WHERE id=$1", [result.rows[0].id, fixture.homeTeamId, fixture.awayTeamId]);
  return { id: result.rows[0].id as string, kickoffAt: new Date(result.rows[0].kickoff_at).toISOString(), reviewRequired: true };
}
