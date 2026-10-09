"use client";
import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { CatalogFeed } from "@/lib/market-display";
import type { CinemaFixture, HeroSlide } from "./types";
import { isActiveMarket } from "@/lib/football-market-core";

export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { setDisplay(value); return; }
    const control = animate(0, value, { duration: .9, ease: [.22, 1, .36, 1], onUpdate: setDisplay });
    return () => control.stop();
  }, [value, reduce]);
  return <>{display.toFixed(decimals)}</>;
}

export function StatsPanel({ feed, fixture, slide, onStory, onMarkets }: { feed: CatalogFeed; fixture: CinemaFixture | null; slide: HeroSlide; onStory: () => void; onMarkets: () => void }) {
  const active = feed.markets.filter(m => isActiveMarket(m, Date.parse(feed.checkedAt)));
  const prices = active.flatMap(m => m.yesPrice != null && Number.isFinite(Number(m.yesPrice)) ? [Number(m.yesPrice)] : []);
  const points = prices.map((value, index) => `${3 + index / Math.max(1, prices.length - 1) * 90},${32 - Math.min(1, Math.max(0, value)) * 27}`).join(" ");
  const timestamp = fixture?.kickoffAt || fixture?.marketEndsAt;
  const date = timestamp ? new Date(timestamp) : null;
  return <aside className="cinema-stats" aria-label="Market overview">
    <button className="cinema-market-stat" onClick={onMarkets}>
      <svg className="cinema-sparkline" width="96" height="38" viewBox="0 0 96 38" aria-label="Current YES prices across markets" role="img"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
      <span className="cinema-market-count"><strong><CountUp value={active.length}/></strong><span className={feed.status === "connected" ? "is-connected" : ""}>{feed.status === "connected" ? "LIVE" : feed.status === "demo" ? "DEMO" : "OFFLINE"}</span></span>
      <span>Active sports markets</span><small>Current Panta feed <ArrowUpRight size={10}/></small>
    </button>
    <button className="cinema-player-note" onClick={onStory}>
      <span className="cinema-player-thumbnail" style={{ backgroundImage: `url(${slide.image})` }}/>
      <strong>{slide.chapter}</strong><span>{fixture ? `${fixture.homeTeam} vs` : "A closer look"}</span><span>{fixture?.awayTeam || "Before the whistle"}</span><ArrowUpRight size={16}/>
    </button>
    <div className="cinema-date-stat"><span className="cinema-micro">{fixture?.kickoffAt ? "Next kickoff" : timestamp ? "Market closes" : "Schedule pending"}</span><strong>{date ? date.getUTCDate().toString().padStart(2, "0") : "—"}</strong><span>{date ? date.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }) : "Schedule pending"}<span className="cinema-date-slash"> / </span>{date ? date.getUTCFullYear() : ""}</span></div>
  </aside>;
}
