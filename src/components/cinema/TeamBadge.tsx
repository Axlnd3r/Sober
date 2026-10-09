"use client";
import { useState } from "react";
import type { TeamAsset } from "@/lib/football-market-core";
import { initials } from "./types";

export function TeamBadge({ team, name, className = "" }: { team?: TeamAsset; name: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = team?.badgeUrl;
  return <span className={`cinema-team-badge ${className}`} role="img" aria-label={`${name} ${src && failed !== src ? "badge" : "initials"}`}>
    {src && failed !== src ? <img src={src} alt="" width={96} height={96} referrerPolicy="no-referrer" onError={() => setFailed(src)}/> : <span className="cinema-badge-fallback" style={{ borderColor: team?.color || undefined }}>{initials(name)}</span>}
  </span>;
}
