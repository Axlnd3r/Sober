import test from "node:test";
import assert from "node:assert/strict";
import { cleanHistory, teamStats, buildEvidence, validateSelection, defaultSelection } from "../src/lib/analysis-core.ts";
import { runAnalystAgent } from "../src/lib/analyst-agent.ts";
import { marketWindow, marketPrice } from "../src/lib/market-display.ts";

const match = (id, date, home, away, homeGoals, awayGoals) => ({ id, utcDate: date, status: "FINISHED", homeTeam: { id: home, name: `Team ${home}` }, awayTeam: { id: away, name: `Team ${away}` }, score: { duration: "REGULAR", fullTime: { home: homeGoals, away: awayGoals } } });
const asOf = "2026-10-08T00:00:00.000Z";
test("history excludes future, other-team, invalid, extra-time and duplicate matches", () => {
  const first = match(1, "2026-10-01T12:00:00Z", 10, 20, 2, 1);
  const rows = cleanHistory([first, first, match(2, "2026-10-09T12:00:00Z", 10, 20, 4, 0), match(3, "2026-10-02T12:00:00Z", 30, 20, 1, 0), { ...first, id: 4, score: { ...first.score, duration: "EXTRA_TIME" } }, { ...first, id: 5, status: "IN_PLAY" }, { ...first, id: 6, score: { duration: "REGULAR", fullTime: { home: null, away: 1 } } }], 10, asOf);
  assert.deepEqual(rows.map(r => r.id), [1]);
});
test("home/away scores are oriented to the team and draws belong to NO", () => {
  const rows = cleanHistory([match(1, "2026-10-01T12:00:00Z", 10, 20, 2, 1), match(2, "2026-10-02T12:00:00Z", 20, 10, 3, 0), match(3, "2026-10-03T12:00:00Z", 10, 20, 1, 1)], 10, asOf);
  const stats = teamStats(10, "Home", rows, "home", "2026-10-10T12:00:00Z");
  assert.equal(stats.form, "D L W"); assert.equal(stats.goalsFor, 3); assert.equal(stats.goalsAgainst, 5);
  assert.equal(stats.venuePlayed, 2); assert.equal(stats.venueWins, 1); assert.equal(stats.restDays, 7);
  const evidence = buildEvidence(stats, { ...stats, teamId: 20, name: "Away" }, rows);
  assert.equal(evidence.some(e => e.side !== "context"), false, "insufficient samples cannot produce directional evidence");
  assert.match(evidence.find(e => e.id === "outcome").text, /NO includes a draw/);
});
test("AI cannot invent evidence or move a counterargument to YES", () => {
  const evidence = [{ id: "draw", side: "no", text: "Draws", sourceIds: ["history"] }, { id: "rules", side: "context", text: "Rules", sourceIds: ["fixture"] }];
  assert.deepEqual(validateSelection(defaultSelection(evidence), evidence).noEvidenceIds, ["draw"]);
  assert.throws(() => validateSelection({ yesEvidenceIds: ["draw"], noEvidenceIds: [], contextEvidenceIds: ["rules"] }, evidence));
  assert.throws(() => validateSelection({ yesEvidenceIds: [], noEvidenceIds: ["invented"], contextEvidenceIds: ["rules"] }, evidence));
});
test("agent calls only snapshot reader and rejects a fabricated tool or incomplete output", async () => {
  const responses = [{ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "get_match_evidence", arguments: "{}" } }] } }] }, { choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ yesEvidenceIds: [], noEvidenceIds: [], contextEvidenceIds: ["rules"] }) } }] }];
  const requests = [];
  const request = async (_url, init) => { requests.push(JSON.parse(init.body)); return Response.json(responses.shift()); };
  const result = await runAnalystAgent({ evidence: [], history: [] }, { key: "test-only", model: "test-model" }, request);
  assert.deepEqual(result.contextEvidenceIds, ["rules"]);
  assert.equal(requests.length, 2); assert.equal(requests[1].messages.at(-1).role, "tool");
  assert.equal(requests[1].tools, undefined, "structured output step has no tools");
  const bad = async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: "bad", type: "function", function: { name: "buy_position", arguments: "{}" } }] } }] });
  await assert.rejects(runAnalystAgent({}, { key: "test", model: "test" }, bad), /Unsupported/);
  await assert.rejects(runAnalystAgent({}, { key: "test", model: "test" }, async () => new Response("", { status: 429 })), /rate limit/);
});
test("catalog respects actual start/end time and preserves zero prices", () => {
  const market = { phase: "primary", startTime: 100, endTime: 200 };
  assert.equal(marketWindow(market, 90_000), "Opening soon");
  assert.equal(marketWindow(market, 150_000), "Primary market");
  assert.equal(marketWindow(market, 200_000), "Trading ended");
  assert.equal(marketPrice("0"), "0 USDC"); assert.equal(marketPrice(null), "Not quoted");
});
