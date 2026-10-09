import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { dbPool } from "./db";
import { getRoomMarket, type Room } from "./rooms";
import { footballConfigured, getFixture, getTeamHistory } from "./football";
import { fixtureReviewIssue } from "./fixture-import";
import { runAnalystAgent } from "./analyst-agent";
import { buildEvidence, cleanHistory, defaultSelection, teamStats, validateSelection, type AnalysisFeed, type AnalysisResult, type AnalysisSnapshot } from "./analysis-core";

export async function readAnalysis(room: Room, snapshotId?: string): Promise<AnalysisFeed> {
  const locked = Date.now() >= Date.parse(room.cutoffAt);
  if (room.demo) return { analysis: null, message: "This fictional room has no team history. Analysis is available for provider-linked fixtures.", stale: false, locked, configured: false };
  const rows = snapshotId ? await dbPool().query("SELECT result FROM match_analyses WHERE room_id=$1 AND id=$2", [room.id, snapshotId]) : await dbPool().query("SELECT result FROM match_analyses WHERE room_id=$1 ORDER BY created_at DESC LIMIT 1", [room.id]);
  const analysis = (rows.rows[0]?.result ?? null) as AnalysisResult | null;
  const configured = footballConfigured() && Boolean(room.providerFixtureId);
  const stale = Boolean(analysis && (Date.parse(analysis.expiresAt) <= Date.now() || room.fixtureIssue || analysis.snapshot.fixture.kickoffAt !== room.kickoffAt || analysis.snapshot.fixture.marketId !== room.pantaMarketId || analysis.snapshot.fixture.question !== room.question));
  return { analysis, stale, locked, configured, message: analysis ? (locked ? "Pre-match snapshot locked. No post-match data has been added." : stale ? "This snapshot needs a refresh. Check its timestamp before using it." : "Statistics and sources captured before kickoff.") : !room.providerFixtureId ? "Team history is not linked to this fixture yet. The host must import a football-data.org fixture." : !footballConfigured() ? "Team history is not available yet. The host needs to connect the football data provider." : locked ? "No pre-match analysis was saved before the cutoff." : "The host has not generated an analysis for this match yet." };
}
export async function generateAnalysis(room: Room): Promise<AnalysisFeed> {
  if (room.demo) throw new Error("Analysis is unavailable for fictional fixtures");
  if (Date.now() >= Date.parse(room.cutoffAt)) throw new Error("Analysis is locked at the forecast cutoff");
  const previous = await readAnalysis(room);
  if (previous.analysis && !previous.stale) return previous;
  if (!room.providerFixtureId || !footballConfigured()) throw new Error("Import a provider fixture and configure football data first");
  const client = await dbPool().connect();
  let held = false;
  try {
    held = (await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS held", [`analysis:${room.id}`])).rows[0].held;
    if (!held) throw new Error("Analysis is already being generated. Check again shortly.");
    const fresh = await readAnalysis(room);
    if (fresh.analysis && !fresh.stale) return fresh;
    const fixture = await getFixture(room.providerFixtureId);
    if (fixtureReviewIssue(room, fixture) || !fixture.homeTeamId || !fixture.awayTeamId) throw new Error("Fixture identity or kickoff needs host review before analysis");
    const asOf = new Date().toISOString();
    const homeHistory = await getTeamHistory(fixture.homeTeamId, asOf);
    const awayHistory = await getTeamHistory(fixture.awayTeamId, asOf);
    const homeRows = cleanHistory(homeHistory.rows, fixture.homeTeamId, asOf);
    const awayRows = cleanHistory(awayHistory.rows, fixture.awayTeamId, asOf);
    const home = teamStats(fixture.homeTeamId, fixture.homeTeam, homeRows, "home", room.kickoffAt);
    const away = teamStats(fixture.awayTeamId, fixture.awayTeam, awayRows, "away", room.kickoffAt);
    const history = [...new Map([...homeRows, ...awayRows].map(m => [m.id, m])).values()];
    const h2h = history.filter(m => [m.homeTeam.id, m.awayTeam.id].includes(home.teamId) && [m.homeTeam.id, m.awayTeam.id].includes(away.teamId));
    const market = await getRoomMarket(room).catch(() => null);
    const evidence = buildEvidence(home, away, h2h);
    const sources = [
      { id: "fixture", label: "Fixture and room rules", url: fixture.sourceUrl, fetchedAt: asOf },
      { id: "home-history", label: `${home.name} match history`, url: homeHistory.sourceUrl, fetchedAt: homeHistory.fetchedAt },
      { id: "away-history", label: `${away.name} match history`, url: awayHistory.sourceUrl, fetchedAt: awayHistory.fetchedAt },
    ];
    const marketTime = new Date().toISOString();
    if (market) {
      sources.push({ id: "panta", label: "Panta market snapshot", url: "https://www.panta.market/", fetchedAt: marketTime });
      evidence.push({ id: "market", side: "context", text: `Panta phase: ${market.phase}. YES price: ${market.yesPrice ?? "unavailable"}; NO price: ${market.noPrice ?? "unavailable"}. Prices are not model probabilities.`, sourceIds: ["panta"] });
    }
    const limitations = ["Historical results do not establish a win probability.", "Opponent strength, injuries, lineups and xG are not included.", "History is limited to up to ten available regular-time matches per team within the provider's accessible period."];
    const enoughData = home.played >= 5 && away.played >= 5;
    if (!enoughData) limitations.unshift("Fewer than five usable matches for at least one team. Directional analysis is withheld.");
    if (!market) limitations.push("No Panta market snapshot is available for this room.");
    const snapshot: AnalysisSnapshot = { asOf, fixture: { home: room.homeTeam, away: room.awayTeam, kickoffAt: room.kickoffAt, cutoffAt: room.cutoffAt, question: room.question, marketId: room.pantaMarketId }, home, away, evidence, sources, limitations, history,
      market: market ? { marketId: market.marketId, title: market.title, phase: market.phase, yesPrice: market.yesPrice ?? null, noPrice: market.noPrice ?? null, fetchedAt: marketTime } : null };
    let selection = defaultSelection(evidence);
    let aiStatus: AnalysisResult["aiStatus"] = enoughData ? "unconfigured" : "insufficient_data";
    const model = process.env.AI_MODEL || "openai/gpt-oss-20b";
    if (enoughData && process.env.GROQ_API_KEY) {
      try { selection = validateSelection(await runAnalystAgent(snapshot, { key: process.env.GROQ_API_KEY, model }), evidence); aiStatus = "ready"; }
      catch { aiStatus = "unavailable"; }
    }
    if (Date.now() >= Date.parse(room.cutoffAt)) throw new Error("Analysis reached the forecast cutoff and was not published");
    const result: AnalysisResult = { id: randomUUID(), snapshot, selection, engine: aiStatus === "ready" ? "groq" : "statistics", model: aiStatus === "ready" ? model : null, aiStatus,
      generatedAt: new Date().toISOString(), expiresAt: new Date(Math.min(Date.parse(room.cutoffAt), Date.now() + 30 * 60_000)).toISOString(), promptVersion: "sober-evidence-v1" };
    await client.query("BEGIN");
    const current = await client.query("SELECT * FROM rooms WHERE id=$1 FOR UPDATE", [room.id]);
    if (!current.rows[0] || new Date(current.rows[0].kickoff_at).toISOString() !== room.kickoffAt || current.rows[0].fixture_issue || (current.rows[0].panta_market_id || null) !== room.pantaMarketId || Date.now() >= new Date(current.rows[0].cutoff_at).getTime()) throw new Error("Room changed during analysis. Review it and retry.");
    await client.query("INSERT INTO match_analyses(id,room_id,snapshot_hash,result,expires_at) VALUES($1,$2,$3,$4,$5)", [result.id, room.id, createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), result, result.expiresAt]);
    await client.query("UPDATE rooms SET home_team_provider_id=$2,away_team_provider_id=$3 WHERE id=$1", [room.id, home.teamId, away.teamId]);
    await client.query("COMMIT");
    return readAnalysis(room);
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { if (held) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [`analysis:${room.id}`]).catch(() => undefined); client.release(); }
}
