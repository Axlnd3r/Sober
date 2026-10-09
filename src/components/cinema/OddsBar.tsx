"use client";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { CatalogMarket } from "@/lib/market-display";
import { priceCents, type HeroSlide } from "./types";

export function OddsBar({ market, count, slides, index, onSlide, onSelect, onMarkets }: { market?: CatalogMarket; count: number; slides: HeroSlide[]; index: number; onSlide: (index: number) => void; onSelect: (side: "YES" | "NO") => void; onMarkets: () => void }) {
  return <div className="cinema-bottom-bar">
    <div className="cinema-odds-group"><span className="cinema-micro">{market ? "Panta · price per share" : "Discover Panta"}</span><div className="cinema-odds">
      {market ? <>{(["YES", "NO"] as const).map(side => <button key={side} className="cinema-odds-chip" onClick={() => onSelect(side)}><span>{side}</span><strong>{priceCents(side === "YES" ? market.yesPrice : market.noPrice)}</strong></button>)}</> : <button className="cinema-odds-chip" onClick={onMarkets}>Explore markets <ArrowUpRight size={12}/></button>}
      <button className="cinema-more-markets" onClick={onMarkets}>{count} markets <ArrowUpRight size={12}/></button>
    </div></div>
    <nav className="cinema-pagination" aria-label="Editorial slides"><button className="cinema-slide-arrow" aria-label="Previous slide" onClick={() => onSlide((index - 1 + slides.length) % slides.length)}><ChevronLeft size={16}/></button>{slides.map((slide, i) => <button key={slide.id} onClick={() => onSlide(i)} aria-label={`Slide ${i + 1}: ${slide.chapter}`} aria-current={index === i ? "true" : undefined} className={index === i ? "is-active" : ""}>{String(i + 1).padStart(2, "0")}</button>)}<button className="cinema-slide-arrow" aria-label="Next slide" onClick={() => onSlide((index + 1) % slides.length)}><ChevronRight size={16}/></button></nav>
  </div>;
}
