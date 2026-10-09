import { dbPool } from "./db";
import { mode, tradingEnabled } from "./config";
import { marketListSchema, marketSchema, panta } from "./panta";

export type Room = {
  id: string; competition: string; homeTeam: string; awayTeam: string;
  kickoffAt: string; fixtureSourceUrl: string; brief: string; cutoffAt: string;
  pantaMarketId: string | null; question: string | null; resolutionRule: string | null;
  sources: string[]; published: boolean; reviewed: boolean; tradingPaused: boolean;
  demo: boolean;
  pantaPhase?: string | null;
  providerFixtureId?: number | null;
  providerStatus?: string | null;
  fixtureSyncedAt?: string | null;
  fixtureIssue?: string | null;
  homeTeamProviderId?: number | null;
  awayTeamProviderId?: number | null;
};
const sample: Room = {
  id: "sample-room", competition: "Demo league", homeTeam: "Rivergate FC", awayTeam: "Harbor City",
  kickoffAt: "2026-12-12T15:00:00.000Z", cutoffAt: "2026-12-12T14:55:00.000Z",
  fixtureSourceUrl: "", brief: "A fictional match room that shows how fans can read the rules, record a view, and review a Panta trade before signing.",
  pantaMarketId: null, question: "Will Rivergate FC beat Harbor City in regular time?", resolutionRule: "YES if Rivergate wins after 90 minutes plus stoppage time. NO if the result is a draw or Harbor City wins. Extra time and penalties do not count.",
  sources: [], published: true, reviewed: false, tradingPaused: true, demo: true,
};
const sampleRooms: Room[] = [sample, ...[
  { id: "sample-northbridge", competition: "Demo league", homeTeam: "Northbridge United", awayTeam: "Eastvale FC", kickoffAt: "2026-12-12T17:30:00.000Z", cutoffAt: "2026-12-12T17:25:00.000Z" },
  { id: "sample-westport", competition: "Demo cup", homeTeam: "Westport Athletic", awayTeam: "Kingsford Town", kickoffAt: "2026-12-13T15:00:00.000Z", cutoffAt: "2026-12-13T14:55:00.000Z" },
  { id: "sample-oldcastle", competition: "Demo cup", homeTeam: "Oldcastle FC", awayTeam: "Lakeside United", kickoffAt: "2026-12-13T19:00:00.000Z", cutoffAt: "2026-12-13T18:55:00.000Z" },
].map(fixture => ({ ...sample, ...fixture, question: `Will ${fixture.homeTeam} beat ${fixture.awayTeam} in regular time?`, resolutionRule: `YES if ${fixture.homeTeam} wins after 90 minutes plus stoppage time. NO for a draw or a ${fixture.awayTeam} win. Extra time and penalties do not count.` }))];
const timestamp = (value: unknown) => (value instanceof Date ? value : new Date(String(value))).toISOString();
function rowToRoom(row: Record<string, unknown>): Room {
  return {
    id: String(row.id), competition: String(row.competition), homeTeam: String(row.home_team), awayTeam: String(row.away_team),
    kickoffAt: timestamp(row.kickoff_at), fixtureSourceUrl: String(row.fixture_source_url), brief: String(row.brief),
    cutoffAt: timestamp(row.cutoff_at), pantaMarketId: row.panta_market_id ? String(row.panta_market_id) : null,
    question: row.question ? String(row.question) : null, resolutionRule: row.resolution_rule ? String(row.resolution_rule) : null,
    sources: Array.isArray(row.sources) ? row.sources as string[] : [], published: Boolean(row.published), reviewed: Boolean(row.reviewed), tradingPaused: Boolean(row.trading_paused), demo: false,
    providerFixtureId: row.provider_fixture_id == null ? null : Number(row.provider_fixture_id),
    providerStatus: row.provider_status == null ? null : String(row.provider_status),
    fixtureSyncedAt: row.fixture_synced_at == null ? null : timestamp(row.fixture_synced_at),
    fixtureIssue: row.fixture_issue == null ? null : String(row.fixture_issue),
    homeTeamProviderId: row.home_team_provider_id == null ? null : Number(row.home_team_provider_id),
    awayTeamProviderId: row.away_team_provider_id == null ? null : Number(row.away_team_provider_id),
  };
}
export async function listRooms(includeDraft = false) {
  if (mode === "simulation") return sampleRooms;
  const result = await dbPool().query(`SELECT * FROM rooms ${includeDraft ? "" : "WHERE published=true AND reviewed=true"} ORDER BY kickoff_at ASC LIMIT 30`);
  return result.rows.map(rowToRoom);
}

export async function listDashboardRooms(includeHistory = false) {
  const rooms = (await listRooms()).filter(room => (includeHistory || new Date(room.kickoffAt).getTime() > Date.now()) && (mode === "simulation" || room.reviewed));
  if (mode === "simulation") return { rooms, pantaFeed: "demo" as const };
  if (!process.env.PANTA_API_KEY) return { rooms, pantaFeed: "unconfigured" as const };
  if (!rooms.some(room => room.pantaMarketId)) return { rooms, pantaFeed: "unmapped" as const };

  try {
    const mappedIds = new Set(rooms.map(room => room.pantaMarketId).filter((id): id is string => Boolean(id)));
    const phases = new Map<string, string>();
    let cursor: string | null | undefined;
    for (let page = 0; page < 8; page++) {
      const path = cursor ? `/markets/?cursor=${encodeURIComponent(cursor)}` : "/markets/";
      const listing = await panta(path, marketListSchema);
      for (const market of listing.items) {
        if (mappedIds.has(market.marketId)) phases.set(market.marketId, market.phase);
      }
      if (phases.size === mappedIds.size || !listing.nextCursor) break;
      cursor = listing.nextCursor;
    }
    const missing = [...mappedIds].filter(id => !phases.has(id));
    const details = await Promise.allSettled(missing.map(id => panta(`/markets/${encodeURIComponent(id)}/`, marketSchema)));
    for (const result of details) {
      if (result.status === "fulfilled") phases.set(result.value.marketId, result.value.phase);
    }
    return { rooms: rooms.map(room => ({ ...room, pantaPhase: room.pantaMarketId ? phases.get(room.pantaMarketId) || null : null })), pantaFeed: "connected" as const };
  } catch {
    return { rooms, pantaFeed: "unavailable" as const };
  }
}
export async function getRoom(id: string, includeDraft = false) {
  if (mode === "simulation") return sampleRooms.find(room => room.id === id) || null;
  const result = await dbPool().query(`SELECT * FROM rooms WHERE id=$1 ${includeDraft ? "" : "AND published=true AND reviewed=true"}`, [id]);
  return result.rows[0] ? rowToRoom(result.rows[0]) : null;
}
export async function getRoomMarket(room: Room) {
  if (!room.pantaMarketId || mode !== "live") return null;
  return panta(`/markets/${encodeURIComponent(room.pantaMarketId)}/`, marketSchema);
}
export function buyEligibility(room: Room, market: Awaited<ReturnType<typeof getRoomMarket>>) {
  const now = Date.now();
  if (room.demo) return "Demo room: no real market is mapped";
  if (!tradingEnabled) return "Trading is not configured";
  if (!room.published || !room.reviewed || !room.pantaMarketId) return "Market mapping is awaiting review";
  if (room.tradingPaused) return "Trading is paused by the host";
  if (now >= new Date(room.cutoffAt).getTime() || now >= new Date(room.kickoffAt).getTime()) return "Predictions closed before kickoff";
  if (!market) return "Panta market is unavailable";
  if (market.phase !== "primary") return market.phase === "opening" ? "Market opens soon" : `Panta phase: ${market.phase}`;
  if (market.startTime && now < market.startTime * 1000) return "Market opens soon";
  if (market.endTime && now >= market.endTime * 1000) return "Panta market has closed";
  return null;
}
