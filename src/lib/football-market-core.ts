import type { CatalogMarket } from "./market-display";

export type TeamAsset = { name: string; id: string | null; badgeUrl: string | null; color: string | null; league: string | null; sourceUrl: string | null; verified: boolean; sport?: string };
export type MatchIdentity = { teamA: string; teamB: string; date: string | null };
export type DiscoveredMatch = {
  marketId: string; homeTeam: string; awayTeam: string; homeAsset: TeamAsset; awayAsset: TeamAsset;
  kickoffAt: string | null; matchDate: string | null; marketEndsAt: string | null;
  competition: string; sourceUrl: string; sourceKind: "panta" | "schedule" | "room";
  roomId?: string; marketQuestion: string;
};
export type FootballOverview = { feed: import("./market-display").CatalogFeed; matches: DiscoveredMatch[] };

const aliases: Record<string, string> = {
  "spurs": "Tottenham Hotspur", "tottenham": "Tottenham Hotspur", "man utd": "Manchester United", "man united": "Manchester United",
  "man city": "Manchester City", "psg": "Paris Saint-Germain", "inter": "Inter Milan", "bayern": "Bayern Munich", "atletico madrid": "Atlético Madrid",
};
export function normalizeTeam(name: string) { return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function canonicalTeam(name: string) { return aliases[normalizeTeam(name)] || name.trim(); }
export function isActiveMarket(market: CatalogMarket, now = Date.now()) { return !market.resolved && !["resolved", "cancelled"].includes(market.phase) && (!market.endTime || market.endTime * 1000 > now); }
function teamText(value: string) { return value.replace(/[?.!:]+$/, "").trim().replace(/^the\s+/i, ""); }
export function parseFootballMatch(market: Pick<CatalogMarket, "title" | "description">): MatchIdentity | null {
  const text = market.title.trim();
  const patterns = [
    /^Will\s+(.+?)\s+(?:beat|defeat|win against|win over)\s+(.+?)(?=\s+(?:on|by|with|in|at|this|during)\b|[?!]|\.$|$)/i,
    /^(.+?)\s+(?:will|to)\s+(?:win|beat|defeat)(?:\s+against|\s+over)?\s+(.+?)(?=\s+(?:on|by|with|in|at|this|during)\b|[?!]|\.$|$)/i,
    /^(.+?)\s+will\s+.+?\s+against\s+(.+?)(?=\s+(?:on|by|with|in|at|this|during)\b|[?!]|\.$|$)/i,
    /^(?:Will\s+)?(.+?)\s+(?:vs\.?|versus|v\.)\s+(.+?)(?=\s+(?:on|by|with|in|at|have|end|finish|total|over|under)\b|\s[-–—:(]|[?]|$)/i,
  ];
  const found = patterns.map(pattern => pattern.exec(text)).find(Boolean);
  if (!found) return null;
  const teamA = teamText(found[1]); const teamB = teamText(found[2]);
  if (![teamA, teamB].every(name => name.length >= 2 && name.length <= 64 && /^[\p{L}\p{N} .&'’-]+$/u.test(name)) || normalizeTeam(teamA) === normalizeTeam(teamB)) return null;
  const dateText = text.match(/\b([A-Za-z]+\s+\d{1,2},?\s+20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2}|20\d{2}-\d{2}-\d{2})\b/)?.[1];
  const date = dateText ? Date.parse(`${dateText} 00:00:00 GMT`) : NaN;
  return { teamA: canonicalTeam(teamA), teamB: canonicalTeam(teamB), date: Number.isFinite(date) ? new Date(date).toISOString().slice(0, 10) : null };
}
export function safeBadgeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && ["www.thesportsdb.com", "r2.thesportsdb.com"].includes(url.hostname) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function pickTeamAsset(requested: string, teams: Record<string, unknown>[]): TeamAsset {
  const name = canonicalTeam(requested);
  const empty: TeamAsset = { name, id: null, badgeUrl: null, color: null, league: null, sourceUrl: null, verified: false };
  const match = teams.find(team => [team.strTeam, ...String(team.strTeamAlternate || "").split(/[;,]/)].some(candidate => typeof candidate === "string" && normalizeTeam(candidate) === normalizeTeam(name)));
  if (match && match.strSport !== "Soccer") return { ...empty, ...(typeof match.strSport === "string" ? { sport: match.strSport } : {}) };
  if (!match || typeof match.idTeam !== "string" || !/^\d+$/.test(match.idTeam)) return empty;
  return { name: String(match.strTeam), id: match.idTeam, badgeUrl: safeBadgeUrl(match.strBadge || match.strTeamBadge), color: typeof match.strColour1 === "string" && /^#[0-9a-f]{6}$/i.test(match.strColour1) ? match.strColour1 : null,
    league: typeof match.strLeague === "string" ? match.strLeague : null, sourceUrl: `https://www.thesportsdb.com/team/${match.idTeam}`, verified: true, sport: "Soccer" };
}
