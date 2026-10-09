import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import type { Room } from "@/lib/rooms";
export function formatKickoff(value: string) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC", timeZoneName: "short" }).format(new Date(value)); }
export function MatchCard({ room, featured = false }: { room: Room; featured?: boolean }) {
  return <Link href={`/matches/${room.id}`} className={`match-card ${featured ? "featured" : ""}`}>
    <div className="match-card-top"><span className="eyebrow">{room.competition}</span><span className={`status-pill ${room.demo ? "sample" : room.pantaMarketId ? "mapped" : "unavailable"}`}>{room.demo ? "SAMPLE ROOM" : room.pantaMarketId ? "PANTA MARKET" : "MARKET UNAVAILABLE"}</span></div>
    <div className="match-card-teams"><div><span className="team-monogram">{room.homeTeam.slice(0, 1)}</span><strong>{room.homeTeam}</strong></div><span className="versus">VS</span><div><span className="team-monogram away">{room.awayTeam.slice(0, 1)}</span><strong>{room.awayTeam}</strong></div></div>
    <div className="match-card-bottom"><span><CalendarDays size={16} /> {formatKickoff(room.kickoffAt)}</span><span className="card-link">Open room <ArrowUpRight size={17} /></span></div>
  </Link>;
}
