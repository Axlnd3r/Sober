import "server-only";
import { z } from "zod";

const officialApiBase = "https://api.football-data.org/v4";
const apiBase = process.env.NODE_ENV !== "production" && process.env.FOOTBALL_API_BASE_URL
  ? process.env.FOOTBALL_API_BASE_URL.replace(/\/$/, "")
  : officialApiBase;
const competitionCode = process.env.FOOTBALL_COMPETITION_CODE || "PL";
const teamSchema = z.object({ id: z.number().int().positive().nullable().optional(), name: z.string().min(2).max(120) });
const fixtureSchema = z.object({
  id: z.number().int().positive(),
  utcDate: z.iso.datetime(),
  status: z.string().min(2),
  lastUpdated: z.iso.datetime().optional(),
  competition: z.object({ code: z.string(), name: z.string().min(2).max(100) }),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
});
const listSchema = z.object({ matches: z.array(z.unknown()) });
export type FootballFixture = {
  providerId: number;
  competition: string;
  competitionCode: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  status: string;
  providerUpdatedAt: string | null;
  sourceUrl: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

export function footballConfigured() { return Boolean(process.env.FOOTBALL_API_KEY); }
export function footballCompetition() { return competitionCode; }

async function request(path: string) {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("Football data is not configured");
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "X-Auth-Token": key, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Football data rate limit reached. Retry later.");
    if (response.status === 401 || response.status === 403) throw new Error("Football data key is invalid or this competition is unavailable");
    throw new Error(`Football data request failed (${response.status})`);
  }
  return response.json() as Promise<unknown>;
}

export function normalizeFixture(value: unknown): FootballFixture | null {
  const parsed = fixtureSchema.safeParse(value);
  if (!parsed.success) return null;
  const fixture = parsed.data;
  if (fixture.competition.code !== competitionCode || fixture.homeTeam.name === fixture.awayTeam.name) return null;
  return {
    providerId: fixture.id,
    competition: fixture.competition.name,
    competitionCode: fixture.competition.code,
    homeTeam: fixture.homeTeam.name,
    awayTeam: fixture.awayTeam.name,
    kickoffAt: new Date(fixture.utcDate).toISOString(),
    status: fixture.status,
    providerUpdatedAt: fixture.lastUpdated ? new Date(fixture.lastUpdated).toISOString() : null,
    sourceUrl: `${apiBase}/matches/${fixture.id}`,
    homeTeamId: fixture.homeTeam.id ?? null,
    awayTeamId: fixture.awayTeam.id ?? null,
  };
}

export function importableFixture(fixture: FootballFixture) {
  return ["SCHEDULED", "TIMED"].includes(fixture.status) && new Date(fixture.kickoffAt).getTime() > Date.now() + 10 * 60_000;
}

export async function listFixtures(dateFrom: string, dateTo: string) {
  const query = new URLSearchParams({ dateFrom, dateTo });
  const response = listSchema.parse(await request(`/competitions/${encodeURIComponent(competitionCode)}/matches?${query}`));
  const fixtures = response.matches.map(normalizeFixture).filter((fixture): fixture is FootballFixture => Boolean(fixture));
  return fixtures.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

export async function getFixture(providerId: number) {
  const fixture = normalizeFixture(await request(`/matches/${providerId}`));
  if (!fixture || fixture.providerId !== providerId) throw new Error("Fixture is unavailable in the configured competition");
  return fixture;
}

export async function getTeamHistory(teamId: number, asOf: string) {
  const end = new Date(asOf);
  const start = new Date(end.getTime() - 180 * 86400_000);
  const query = new URLSearchParams({ status: "FINISHED", dateFrom: start.toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10), limit: "100" });
  const path = `/teams/${teamId}/matches?${query}`;
  const result = listSchema.parse(await request(path));
  return { rows: result.matches, sourceUrl: `${officialApiBase}${path}`, fetchedAt: new Date().toISOString() };
}
