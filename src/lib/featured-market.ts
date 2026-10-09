import type { CatalogMarket } from "./market-display";

type FixtureIdentity = { homeTeam: string; awayTeam: string; kickoffAt: string };
const normalized = (team: string) => team.trim().replace(/\s+/g, " ").toLowerCase();

// Public schedule previews may show a price only for the same dated home-win question.
// This discovery link never authorizes a trade or replaces an admin-reviewed mapping.
export function findFixtureMarket(markets: CatalogMarket[], fixture: FixtureIdentity, mappedId?: string | null) {
  if (mappedId) return markets.find(market => market.marketId === mappedId);
  const kickoff = Date.parse(fixture.kickoffAt);
  if (!Number.isFinite(kickoff)) return undefined;
  const fixtureDay = new Date(kickoff).toISOString().slice(0, 10);
  return markets.find(market => {
    if (market.phase === "resolved") return false;
    const question = /^Will (.+?) beat (.+?) on ([A-Za-z]+ \d{1,2}, \d{4})\?$/i.exec(market.title.trim());
    if (!question || normalized(question[1]) !== normalized(fixture.homeTeam) || normalized(question[2]) !== normalized(fixture.awayTeam)) return false;
    const day = Date.parse(`${question[3]} 00:00:00 GMT`);
    return Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === fixtureDay;
  });
}
