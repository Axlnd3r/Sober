import { FootballDashboard } from "@/components/FootballDashboard";
import { listDashboardRooms } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export default async function SavedMatches() {
  const listing = await listDashboardRooms(true).then(listing => ({ ...listing, failed: false })).catch(() => ({ rooms: [], failed: true }));
  return <FootballDashboard {...listing} initialSaved compact />;
}
