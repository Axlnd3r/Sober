"use client";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import type { DiscoveredMatch } from "@/lib/football-market-core";
import { TeamBadge } from "./TeamBadge";

export function FixtureSwitcher({ matches, selected, onSelect, onMore, onRefresh, busy, hasMore, onLoadMore }: { matches: DiscoveredMatch[]; selected?: string; onSelect: (id: string) => void; onMore: () => void; onRefresh: () => void; busy: boolean; hasMore: boolean; onLoadMore: () => void }) {
  return <section className="cinema-fixture-switcher" aria-label="Matches discovered from Panta">
    <div className="cinema-switcher-label"><span>ON PANTA <b>{matches.length.toString().padStart(2, "0")}</b></span><button onClick={onRefresh} disabled={busy} aria-label="Refresh overview"><RefreshCw size={11} className={busy ? "is-refreshing" : ""}/>{busy ? "Updating" : "Refresh"}</button></div>
    <div className="cinema-fixture-track">{matches.map(match => <button key={match.marketId} className={`cinema-fixture-choice ${selected === match.marketId ? "is-active" : ""}`} aria-pressed={selected === match.marketId} aria-label={`Show ${match.homeTeam} vs ${match.awayTeam}`} onClick={() => onSelect(match.marketId)}><span className="cinema-choice-badges"><TeamBadge team={match.homeAsset} name={match.homeTeam}/><TeamBadge team={match.awayAsset} name={match.awayTeam}/></span><span><strong>{match.homeTeam}</strong><small>vs {match.awayTeam}</small></span></button>)}<button className="cinema-fixture-more" onClick={hasMore ? onLoadMore : onMore}>{hasMore ? "Load more" : "All markets"}<ArrowUpRight size={13}/></button></div>
  </section>;
}
