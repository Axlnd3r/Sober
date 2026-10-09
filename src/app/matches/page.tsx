import { FootballDashboard } from "@/components/FootballDashboard";
import { listDashboardRooms } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export default async function Matches({ searchParams }: { searchParams: Promise<{ q?: string; focus?: string }> }) {
  const params = await searchParams;
  const listing = await listDashboardRooms(true).then(listing => ({ ...listing, failed: false })).catch(() => ({ rooms: [], failed: true }));
  return <FootballDashboard key={params.q || "matches"} {...listing} compact initialQuery={params.q || ""} focusSearch={params.focus === "search"} />;
}
