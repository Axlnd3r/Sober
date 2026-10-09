import test from "node:test";
import assert from "node:assert/strict";
import { findFixtureMarket } from "../src/lib/featured-market.ts";

test("fixture prices require the same dated home-win question or a reviewed mapping", () => {
  const fixture = { homeTeam: "Arsenal", awayTeam: "Leeds United", kickoffAt: "2026-10-10T11:30:00Z" };
  const market = { marketId: "same-fixture", title: "Will Arsenal beat Leeds United on October 10, 2026?", category: "Sports", phase: "secondary" };
  const wrongDate = { ...market, marketId: "other-date", title: "Will Arsenal beat Leeds United on October 17, 2026?" };
  const awayWin = { ...market, marketId: "away-win", title: "Will Leeds United beat Arsenal on October 10, 2026?" };
  const goals = { ...market, marketId: "goals", title: "Will Arsenal vs Leeds United have over 2.5 goals on October 10, 2026?" };
  assert.equal(findFixtureMarket([wrongDate, awayWin, goals], fixture), undefined);
  assert.equal(findFixtureMarket([wrongDate, awayWin, goals, market], fixture), market);
  assert.equal(findFixtureMarket([{ ...market, phase: "resolved" }], fixture), undefined);
  assert.equal(findFixtureMarket([market], { ...fixture, kickoffAt: "invalid" }), undefined);
  assert.equal(findFixtureMarket([goals, market], fixture, "goals"), goals);
});
