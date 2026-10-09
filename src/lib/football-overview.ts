import "server-only";
import { getPantaCatalog } from "./panta-catalog";
import { listPublicFixtures } from "./public-fixtures";
import { listRooms } from "./rooms";
import { canonicalTeam, isActiveMarket, normalizeTeam, parseFootballMatch, pickTeamAsset, type FootballOverview, type TeamAsset, type DiscoveredMatch } from "./football-market-core";

const teamCache = new Map<string, { until: number; value: Promise<TeamAsset> }>();
export function getTeamAsset(name: string): Promise<TeamAsset> {
  const teamName = canonicalTeam(name);
  const key = normalizeTeam(teamName);
  const cached = teamCache.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  if (teamCache.size > 250) teamCache.delete(teamCache.keys().next().value!);
  const value = (async () => {
    try {
      const response = await fetch(`https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(teamName)}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5500) });
      if (!response.ok) throw new Error("Team provider unavailable");
      const data: unknown = await response.json();
      const teams = data && typeof data === "object" && "teams" in data && Array.isArray(data.teams) ? data.teams.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
      return pickTeamAsset(teamName, teams);
    } catch { return pickTeamAsset(teamName, []); }
  })();
  teamCache.set(key, { until: Date.now() + 86400_000, value });
  void value.then(asset => { if (!asset.verified) { const entry = teamCache.get(key); if (entry?.value === value) entry.until = Date.now() + 300_000; } });
  return value;
}

export async function getFootballOverview(cursor = ""): Promise<FootballOverview> {
  const [feed, schedule, rooms] = await Promise.all([getPantaCatalog(cursor), listPublicFixtures().catch(() => []), listRooms().catch(() => [])]);
  const candidates = feed.markets.filter(market => isActiveMarket(market)).flatMap(market => { const identity = parseFootballMatch(market); return identity ? [{ market, identity }] : []; });
  const names = [...new Set(candidates.flatMap(item => [item.identity.teamA, item.identity.teamB]))];
  const assets = new Map<string, TeamAsset>();
  // Limit first-load provider work; additional or unavailable teams retain visible name fallbacks.
  for (let offset = 0; offset < Math.min(names.length, 20); offset += 4) {
    const batch = await Promise.allSettled(names.slice(offset, offset + 4).map(async name => ({ name, asset: await getTeamAsset(name) })));
    for (const result of batch) if (result.status === "fulfilled") assets.set(result.value.name, result.value.asset);
  }
  const matches: DiscoveredMatch[] = candidates.flatMap(({ market, identity }) => {
    const homeAsset = assets.get(identity.teamA) || pickTeamAsset(identity.teamA, []);
    const awayAsset = assets.get(identity.teamB) || pickTeamAsset(identity.teamB, []);
    if ([homeAsset, awayAsset].some(asset => asset.sport && asset.sport !== "Soccer")) return [];
    const room = rooms.find(item => item.pantaMarketId === market.marketId);
    const fixture = identity.date ? schedule.find(item => item.kickoffAt.slice(0, 10) === identity.date && normalizeTeam(canonicalTeam(item.homeTeam)) === normalizeTeam(identity.teamA) && normalizeTeam(canonicalTeam(item.awayTeam)) === normalizeTeam(identity.teamB)) : undefined;
    return [{
      marketId: market.marketId, marketQuestion: market.title, homeTeam: homeAsset.name, awayTeam: awayAsset.name, homeAsset, awayAsset,
      kickoffAt: room?.kickoffAt || fixture?.kickoffAt || null, matchDate: identity.date,
      marketEndsAt: market.endTime ? new Date(market.endTime * 1000).toISOString() : null,
      competition: room?.competition || fixture?.competition || (homeAsset.league === awayAsset.league ? homeAsset.league : null) || "Panta sports market",
      sourceUrl: room?.fixtureSourceUrl || (fixture ? `https://www.thesportsdb.com/event/${fixture.id}` : "https://www.panta.market/"),
      sourceKind: room ? "room" : fixture ? "schedule" : "panta", ...(room ? { roomId: room.id } : {}),
    }];
  });
  return { feed, matches };
}
