import test from "node:test";
import assert from "node:assert/strict";
import { captureDecision, forecastDeadline, forecastText } from "../src/lib/forecast-receipt.ts";

const room = {
  homeTeam: "Test Home", awayTeam: "Test Away", question: "Will Test Home win?",
  kickoffAt: "2026-12-12T15:00:00.000Z", cutoffAt: "2026-12-12T14:55:00.000Z",
  resolutionRule: "Regular time only", fixtureSourceUrl: "https://example.com/fixture", sources: [], pantaMarketId: "market-a",
};

test("decision records keep zero quotes and never attach another market's prices", () => {
  const snapshot = captureDecision(room, { marketId: "market-a", phase: "secondary", yesPrice: "0", noPrice: null, primaryNoPrice: "0.5" });
  assert.equal(snapshot.market.yesPrice, "0");
  assert.equal(snapshot.market.noPrice, null, "a secondary market must not fall back to an old primary price");
  assert.equal(captureDecision(room, { marketId: "wrong-market", phase: "primary", yesPrice: "0.7" }).marketStatus, "unavailable");
  assert.equal(captureDecision(room, null).market, null);
  assert.equal(captureDecision({ ...room, pantaMarketId: null }, null).marketStatus, "unmapped");
  assert.equal(captureDecision(room, { marketId: "market-a", phase: "primary", yesPrice: "2" }).market.yesPrice, null);
});

test("a later fixture cutoff cannot reopen a recorded forecast", () => {
  const forecast = { side: "yes", reason: "Recorded reason", analysis_id: null, created_at: "2026-12-11T10:00:00Z",
    updated_at: "2026-12-11T11:00:00Z", decision_snapshot: captureDecision(room, null) };
  assert.equal(forecastDeadline(forecast, "2026-12-13T14:55:00Z"), Date.parse(room.cutoffAt));
  assert.equal(forecastDeadline(forecast, "2026-12-11T14:55:00Z"), Date.parse("2026-12-11T14:55:00Z"));
  assert.equal(forecastDeadline({ ...forecast, decision_snapshot: null }, room.cutoffAt), Date.parse(room.cutoffAt));
  const text = forecastText(forecast, room, "https://example.com/matches/test");
  assert.match(text, /Recorded reason/);
  assert.match(text, /2026-12-11T11:00:00Z/);
  assert.match(text, /does not prove a trade or a result/);
  assert.match(forecastText(forecast, room, "https://example.com/matches/test", true), /practice forecast/);
});
