import "server-only";
import { z } from "zod";

const endpoint = "https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4328";
const eventSchema = z.object({
  idEvent: z.string(),
  idLeague: z.string(),
  strSport: z.string(),
  strLeague: z.string(),
  strHomeTeam: z.string(),
  strAwayTeam: z.string(),
  strTimestamp: z.string().nullable(),
  strStatus: z.string().nullable(),
  strPostponed: z.string().nullable(),
});
const responseSchema = z.object({ events: z.array(eventSchema).nullable() });

export type PublicFixture = {
  id: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
};

export async function listPublicFixtures(): Promise<PublicFixture[]> {
  const response = await fetch(endpoint, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Public fixture feed failed (${response.status})`);
  const parsed = responseSchema.parse(await response.json());
  const now = Date.now();
  return (parsed.events || []).flatMap(event => {
    if (event.idLeague !== "4328" || event.strSport !== "Soccer" || event.strPostponed === "yes" || event.strStatus !== "NS") return [];
    const kickoff = Date.parse(`${event.strTimestamp || ""}Z`);
    if (!Number.isFinite(kickoff) || kickoff <= now || !event.strHomeTeam || !event.strAwayTeam) return [];
    return [{ id: event.idEvent, competition: event.strLeague, homeTeam: event.strHomeTeam, awayTeam: event.strAwayTeam, kickoffAt: new Date(kickoff).toISOString() }];
  });
}
