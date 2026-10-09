import { MatchRoom } from "@/components/MatchRoom";
export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) { return <MatchRoom id={(await params).id}/>; }
