"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { CatalogMarket } from "@/lib/market-display";
import { initials, type CinemaFixture } from "./types";
import { CountUp } from "./StatsPanel";
import { TeamBadge } from "./TeamBadge";
import type { TeamAsset } from "@/lib/football-market-core";

export function Crest({ label, tone = "red" }: { label: string; tone?: string }) {
  return <span className={`cinema-crest tone-${tone}`} aria-hidden="true"><svg viewBox="0 0 40 46" fill="none"><path d="M6 5Q20 0 34 5V24Q33 36 20 42Q7 36 6 24Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="1.2"/><path d="M10 11H30M12 31L20 35L28 31" stroke="currentColor" strokeOpacity=".65"/></svg><b>{label}</b></span>;
}
function PriceRing({ value, side, team, tone, asset }: { value?: string | null; side: string; team: string; tone: string; asset?: TeamAsset }) {
  const number = value == null ? null : Number(value);
  const valid = number !== null && Number.isFinite(number) && number >= 0 && number <= 1;
  const reduce = useReducedMotion();
  return <div className={`cinema-price-ring tone-${tone}`}>
    <div className="cinema-ring-art"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="white" strokeOpacity=".15" strokeWidth="1.5"/><motion.circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeDasharray={182.21} initial={{ strokeDashoffset: 182.21 }} animate={{ strokeDashoffset: 182.21 * (1 - (valid ? number : 0)) }} transition={{ duration: reduce ? 0 : 1, ease: [.22, 1, .36, 1] }} transform="rotate(-90 32 32)"/></svg><TeamBadge team={asset} name={team}/></div>
    <span className="cinema-ring-team-name">{team}</span><strong><span>{side} </span>{valid ? <><CountUp value={number * 100} decimals={1}/>¢</> : "—"}</strong>
  </div>;
}
export function MatchWidget({ fixture, market, onFixture }: { fixture: CinemaFixture | null; market?: CatalogMarket; onFixture: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const timestamp = fixture?.kickoffAt || fixture?.marketEndsAt;
  const remaining = timestamp && now !== null ? Math.max(0, Math.floor((Date.parse(timestamp) - now) / 1000)) : null;
  const values = remaining === null ? ["--", "--", "--", "--"] : [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60].map(n => String(n).padStart(2, "0"));
  return <button className="cinema-match-widget" onClick={onFixture} aria-label={`View fixture and market information${market ? `: ${market.title}` : ""}`}>
    <div className="cinema-match-rings"><PriceRing value={market?.yesPrice} side="YES" team={fixture?.homeTeam || "YES"} asset={fixture?.homeAsset} tone="green"/><span className="cinema-vs">vs</span><PriceRing value={market?.noPrice} side="NO" team={fixture?.awayTeam || "NO"} asset={fixture?.awayAsset} tone="red"/></div>
    <div className="cinema-countdown"><span className="cinema-countdown-kind">{fixture?.kickoffAt ? "KICKOFF IN" : timestamp ? "MARKET CLOSES IN" : "KICKOFF TO BE CONFIRMED"}</span><span className="cinema-countdown-date">{timestamp ? new Date(timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "long", timeZone: "UTC" }) : fixture?.matchDate || "Next fixture"} <b>{timestamp ? new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "TBC"}</b> UTC</span><div className="cinema-clock" aria-label={remaining === 0 ? "Countdown ended" : fixture?.kickoffAt ? "Time to kickoff" : "Time until market closes"}>{values.map((value, i) => <div key={i}><strong>{value}</strong><small>{["DAY", "HR", "MIN", "SEC"][i]}</small></div>)}</div><span className="cinema-ring-caption">{market ? "YES / NO answer the market question · ¢" : "Market prices not available"}</span></div>
  </button>;
}
