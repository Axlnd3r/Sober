"use client";
import Link from "next/link";
import { Plus, CircleHelp } from "lucide-react";
import { TeamBadge } from "./TeamBadge";
import type { DiscoveredMatch } from "@/lib/football-market-core";
export function ClubSidebar({ matches, selected, onMatch, onAll }: { matches: DiscoveredMatch[]; selected?: string; onMatch: (id: string) => void; onAll: () => void }) {
  const clubs = [...new Map(matches.flatMap(match => [match.homeAsset, match.awayAsset].map(team => [team.name, { team, marketId: match.marketId }] as const))).values()];
  return <aside className="cinema-clubs" aria-label="Teams in Panta markets"><div className="cinema-rail-top">FC</div><div className="cinema-club-list">{clubs.map(({ team, marketId }) => <button key={team.name} title={`${team.name} match`} aria-label={`${team.name} match`} aria-pressed={selected === marketId} onClick={() => onMatch(marketId)}><TeamBadge team={team} name={team.name}/></button>)}<button className="cinema-add-club" title="Browse all sports markets" aria-label="Browse all sports markets" onClick={onAll}><Plus size={16}/></button></div><Link href="/privacy" aria-label="Privacy and information" title="Privacy and information"><CircleHelp size={16}/></Link></aside>;
}
