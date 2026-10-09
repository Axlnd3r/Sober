import { HeroSlider } from "@/components/cinema/HeroSlider";
import { listDashboardRooms } from "@/lib/rooms";
import { listPublicFixtures } from "@/lib/public-fixtures";
import { getFootballOverview } from "@/lib/football-overview";
import type { CinemaFixture } from "@/components/cinema/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [listing, publicFixtures, overview] = await Promise.all([
    listDashboardRooms().catch(() => ({ rooms: [] })),
    listPublicFixtures().catch(() => []),
    getFootballOverview(),
  ]);
  const room = listing.rooms[0];
  const upcoming = publicFixtures[0];
  const fixture: CinemaFixture | null = room ? {
    homeTeam: room.homeTeam, awayTeam: room.awayTeam, competition: room.competition,
    kickoffAt: room.kickoffAt, sourceUrl: room.fixtureSourceUrl, roomId: room.id,
  } : upcoming ? { ...upcoming, sourceUrl: `https://www.thesportsdb.com/event/${encodeURIComponent(upcoming.id)}` } : null;
  return <HeroSlider initialFeed={overview.feed} initialMatches={overview.matches} fixture={fixture} rooms={listing.rooms.map(({ id, pantaMarketId, homeTeam, awayTeam }) => ({ id, pantaMarketId, homeTeam, awayTeam }))}/>;
}
