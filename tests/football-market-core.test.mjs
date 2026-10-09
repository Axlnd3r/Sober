import test from "node:test";
import assert from "node:assert/strict";
import { parseFootballMatch, pickTeamAsset, isActiveMarket, safeBadgeUrl } from "../src/lib/football-market-core.ts";

test("Panta match discovery handles different teams and question types without inventing dates", () => {
  assert.deepEqual(parseFootballMatch({ title: "Will Arsenal beat Leeds United on October 10, 2026?" }), { teamA: "Arsenal", teamB: "Leeds United", date: "2026-10-10" });
  assert.deepEqual(parseFootballMatch({ title: "Manchester United will win against Spurs with 2 or more goals" }), { teamA: "Manchester United", teamB: "Tottenham Hotspur", date: null });
  assert.deepEqual(parseFootballMatch({ title: "France will concede in the first 25 minutes against Belgium on the 05 October." }), { teamA: "France", teamB: "Belgium", date: null });
  assert.deepEqual(parseFootballMatch({ title: "Paris Saint-Germain vs Borussia Dortmund - Champions League" }), { teamA: "Paris Saint-Germain", teamB: "Borussia Dortmund", date: null });
  assert.deepEqual(parseFootballMatch({ title: "Will Bayern Munich beat St. Pauli?" }), { teamA: "Bayern Munich", teamB: "St. Pauli", date: null });
  assert.equal(parseFootballMatch({ title: "Saka 7+ points, GW6" }), null);
  assert.equal(parseFootballMatch({ title: "Will Arsenal win the league?" }), null);
});

test("club badges require exact football identity, trusted URLs, and fallback on ambiguity", () => {
  const badge = "https://r2.thesportsdb.com/images/media/team/badge/example.png";
  const team = { idTeam: "133616", strTeam: "Tottenham Hotspur", strSport: "Soccer", strBadge: badge, strColour1: "#ffffff" };
  assert.equal(pickTeamAsset("Spurs", [team]).badgeUrl, badge);
  assert.equal(pickTeamAsset("Tottenham", [{ ...team, strTeam: "Tottenham Women" }]).verified, false);
  assert.equal(pickTeamAsset("Spurs", [{ ...team, strTeam: "Austin Spurs", strSport: "Basketball" }]).verified, false);
  assert.equal(pickTeamAsset("Tottenham Hotspur", [{ ...team, strBadge: "javascript:alert(1)" }]).badgeUrl, null);
  assert.equal(safeBadgeUrl("https://r2.thesportsdb.com.attacker.test/logo.svg"), null);
  assert.equal(safeBadgeUrl("https://username@r2.thesportsdb.com/logo.png"), null);
  assert.equal(pickTeamAsset("Unknown Club", []).name, "Unknown Club");
});

test("resolved flags and ended windows keep historical Panta markets out of the active overview", () => {
  const base = { marketId: "m", title: "A vs B", category: "sports", phase: "secondary" };
  assert.equal(isActiveMarket({ ...base, resolved: true }), false);
  assert.equal(isActiveMarket({ ...base, phase: "cancelled" }), false);
  assert.equal(isActiveMarket({ ...base, endTime: 1 }, 2000), false);
  assert.equal(isActiveMarket({ ...base, startTime: 4, endTime: 10 }, 2000), true);
});
