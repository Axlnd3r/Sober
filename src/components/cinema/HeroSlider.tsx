"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "framer-motion";
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, CalendarDays } from "lucide-react";
import { api } from "@/lib/client-api";
import type { CatalogFeed } from "@/lib/market-display";
import { findFixtureMarket } from "@/lib/featured-market";
import { isActiveMarket, type FootballOverview } from "@/lib/football-market-core";
import { FixtureSwitcher } from "./FixtureSwitcher";
import { Navbar } from "./Navbar";
import { StatsPanel } from "./StatsPanel";
import { MatchWidget } from "./MatchWidget";
import { OddsBar } from "./OddsBar";
import { ClubSidebar } from "./ClubSidebar";
import { BetSlipButton } from "./BetSlipButton";
import { MatchDrawer } from "./MatchDrawer";
import { makeSlides, type CinemaProps, type DrawerTab, type MarketSelection } from "./types";

const ease = [.22, 1, .36, 1] as const;
export function HeroSlider({ initialFeed, fixture: fallbackFixture, rooms, initialMatches = [] }: CinemaProps) {
  const [feed, setFeed] = useState(initialFeed);
  const [matches, setMatches] = useState(initialMatches);
  const [activeMarketId, setActiveMarketId] = useState(initialMatches[0]?.marketId);
  const fixture = matches.find(match => match.marketId === activeMarketId) || matches[0] || fallbackFixture;
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<DrawerTab | null>(null);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<MarketSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refreshing = useRef(false);
  const loadedCursors = useRef(new Set<string>());
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 60, damping: 25 });
  const y = useSpring(0, { stiffness: 60, damping: 25 });
  const slides = useMemo(() => makeSlides(fixture), [fixture]);
  const slide = slides[index];
  const mappedId = fixture?.roomId ? rooms.find(room => room.id === fixture.roomId)?.pantaMarketId : null;
  const featuredMarket = fixture?.marketId ? feed.markets.find(market => market.marketId === fixture.marketId) : fixture?.kickoffAt ? findFixtureMarket(feed.markets, { ...fixture, kickoffAt: fixture.kickoffAt }, mappedId) : undefined;
  const openMarkets = useCallback((search = "") => { setQuery(search); setTab("markets"); }, []);
  const refresh = useCallback(async (cursor = "") => {
    if (refreshing.current) return;
    refreshing.current = true;
    setBusy(true); setError("");
    try {
      const next = await api<FootballOverview>(`/api/panta/overview${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (next.feed.status === "unavailable") { setError("Panta is unavailable. Showing the last successful update."); return; }
      if (cursor) loadedCursors.current.add(cursor); else loadedCursors.current.clear();
      setFeed(previous => cursor ? { ...next.feed, scanned: previous.scanned + next.feed.scanned, markets: [...new Map([...previous.markets, ...next.feed.markets].map(market => [market.marketId, market])).values()] } : next.feed);
      setMatches(previous => cursor ? [...new Map([...previous, ...next.matches].map(match => [match.marketId, match])).values()] : next.matches);
    } catch { setError("Panta could not be reached. Displayed prices are from the last successful check."); }
    finally { refreshing.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);
  useEffect(() => {
    if (!feed.nextCursor || loadedCursors.current.has(feed.nextCursor) || busy || error) return;
    const timer = setTimeout(() => void refresh(feed.nextCursor!), 1500);
    return () => clearTimeout(timer);
  }, [feed.nextCursor, busy, error, refresh]);
  function showMatch(id: string) { setActiveMarketId(id); setIndex(0); }
  function changeSelection(next: MarketSelection | null) { setSelection(next); if (next && matches.some(match => match.marketId === next.marketId)) showMatch(next.marketId); }
  function select(side: "YES" | "NO") { if (featuredMarket) setSelection({ marketId: featuredMarket.marketId, side }); openMarkets(); }
  return <div className="cinema-shell">
    <a className="skip-content" href="#cinema-content">Skip to content</a>
    <div className="cinema-scene" onPointerMove={event => {
      if (reduce || event.pointerType !== "mouse" || window.innerWidth < 1280) return;
      x.set((event.clientX / window.innerWidth - .5) * -14); y.set((event.clientY / window.innerHeight - .5) * -8);
    }} onPointerLeave={() => { x.set(0); y.set(0); }}>
      <div className="cinema-photography" aria-hidden="true"><AnimatePresence initial={false}><motion.div className="cinema-photo-slide" key={slide.id} initial={{ opacity: 0, scale: reduce ? 1 : 1.045 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .85, ease }}><motion.img src={slide.image} alt="" width={1536} height={1024} fetchPriority={index === 0 ? "high" : "auto"} style={{ x, y }}/></motion.div></AnimatePresence></div>
      <div className="cinema-photo-shade"/>
      <div className="cinema-slice-lines" aria-hidden="true"><span/><span/><span/></div>
      <AnimatePresence initial={false}><motion.div key={`slices-${index}`} className="cinema-transition-slices" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <motion.span key={i} initial={{ scaleY: 0, transformOrigin: "bottom" }} animate={{ scaleY: [0, 1, 0] }} transition={{ duration: reduce ? 0 : .75, delay: reduce ? 0 : i * .055, ease, times: [0, .42, 1] }}/>)}</motion.div></AnimatePresence>
      <Navbar onSearch={() => openMarkets()} onMarkets={() => openMarkets()}/>
      <main id="cinema-content" className="cinema-main" tabIndex={-1}>
        <StatsPanel feed={feed} fixture={fixture} slide={slide} onStory={() => setTab("story")} onMarkets={() => openMarkets()}/>
        <MatchWidget fixture={fixture} market={featuredMarket} onFixture={() => setTab("fixture")}/>
        <FixtureSwitcher matches={matches} selected={fixture?.marketId} onSelect={showMatch} onMore={() => openMarkets()} onRefresh={() => void refresh()} busy={busy} hasMore={Boolean(feed.nextCursor)} onLoadMore={() => void refresh(feed.nextCursor || "")}/>
        <section className="cinema-editorial" aria-roledescription="carousel" aria-label="Football perspectives">
          <div className="cinema-editorial-meta"><span>{feed.status === "demo" ? `Demo fixture · ${slide.category}` : slide.category}</span><i/><span>Sober notebook</span></div>
          <AnimatePresence mode="wait" initial={false}><motion.div key={slide.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .16 }} aria-live="polite" aria-atomic="true"><p className="cinema-editorial-subtitle">{slide.subtitle}</p><h1>{slide.heading.map((line, i) => <span className="cinema-headline-mask" key={line}><motion.span initial={{ y: reduce ? 0 : "105%" }} animate={{ y: 0 }} transition={{ duration: reduce ? 0 : .8, delay: i * .07, ease }}>{line}</motion.span></span>)}</h1></motion.div></AnimatePresence>
          {index === 0 && fixture?.marketQuestion && <p className="cinema-market-question">{fixture.marketQuestion}</p>}
          <div className="cinema-story-actions"><button onClick={() => setTab("story")} className="cinema-read-story"><span><ArrowRight size={16}/></span>Read story</button><button onClick={() => setTab("fixture")}><span><CalendarDays size={15}/></span>Match info</button><button onClick={() => setTab("analyst")}><span><ChartNoAxesCombined size={15}/></span>Statistics</button></div>
        </section>
        <button className="cinema-next-preview" onClick={() => setIndex((index + 1) % slides.length)} aria-label={`Next: ${slides[(index + 1) % slides.length].chapter}`}><span>UP NEXT / 0{(index + 1) % slides.length + 1}</span><strong>{slides[(index + 1) % slides.length].chapter.replace("The ", "")}</strong><ArrowRight size={19}/></button>
        <OddsBar market={featuredMarket} count={feed.markets.filter(m => isActiveMarket(m, Date.parse(feed.checkedAt))).length} slides={slides} index={index} onSlide={setIndex} onSelect={select} onMarkets={() => openMarkets()}/>
        <div className="cinema-bottom-caption"><span>FOOTBALL, IN FOCUS.</span><button onClick={() => openMarkets()} className="cinema-connection"><i className={feed.status === "connected" && !error ? "is-connected" : ""}/>{error ? "Panta update failed" : feed.status === "connected" ? "Panta connected" : feed.status === "demo" ? "Simulation · no live markets" : "Panta connection unavailable"}<ArrowUpRight size={10}/></button><span className="cinema-art-credit">Illustrative athletes</span></div>
      </main>
      <div className="cinema-foreground" aria-hidden="true"><AnimatePresence initial={false}><motion.div key={slide.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .65 }}><motion.img src={slide.image} alt="" width={1536} height={1024} style={{ x, y, clipPath: slide.foregroundClip }}/></motion.div></AnimatePresence></div>
      <BetSlipButton selected={selection !== null} onClick={() => openMarkets()}/>
    </div>
    <ClubSidebar matches={matches} selected={fixture?.marketId} onMatch={showMatch} onAll={() => openMarkets()}/>
    <MatchDrawer tab={tab} onTab={setTab} onClose={() => setTab(null)} feed={feed} fixture={fixture} rooms={rooms} slide={slide} query={query} onQuery={setQuery} refresh={() => void refresh()} busy={busy} error={error} selection={selection} onSelection={changeSelection}/>
  </div>;
}
