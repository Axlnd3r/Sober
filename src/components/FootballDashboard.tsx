"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVisibleRefresh } from "@/hooks/useVisibleRefresh";
import { ArrowRight, ArrowUpRight, Bookmark, CalendarDays, ChevronLeft, ChevronRight, Pause, Play, Search, ShieldCheck, Trophy, X } from "lucide-react";
import type { Room } from "@/lib/rooms";
import type { PublicFixture } from "@/lib/public-fixtures";

const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value));
const initials = (name: string) => name.split(" ").filter(word => !["FC", "United", "City", "Town", "Athletic"].includes(word)).map(word => word[0]).join("").slice(0, 2);
const crestIds: Record<string, number> = {
  "liverpool": 64, "liverpool fc": 64, "manchester united": 66, "manchester united fc": 66,
  "man united": 66, "arsenal": 57, "arsenal fc": 57, "chelsea": 61, "chelsea fc": 61,
  "manchester city": 65, "manchester city fc": 65, "man city": 65,
  "newcastle united": 67, "newcastle united fc": 67, "aston villa": 58, "aston villa fc": 58,
};

function TeamBadge({ name, away = false }: { name: string; away?: boolean }) {
  const crestId = crestIds[name.trim().toLowerCase()];
  return <span className={`club-badge ${away ? "away" : ""} ${crestId ? "has-crest" : ""}`} aria-hidden="true">{initials(name)}{crestId && <img key={name} src={`https://crests.football-data.org/${crestId}.png`} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }}/>}</span>;
}

export function FootballDashboard({ rooms, failed, pantaFeed = "demo", publicFixtures = [], publicFixtureError = false, compact = false, initialSaved = false, initialQuery = "", focusSearch = false }: { rooms: Room[]; failed: boolean; pantaFeed?: "demo" | "connected" | "unconfigured" | "unmapped" | "unavailable"; publicFixtures?: PublicFixture[]; publicFixtureError?: boolean; compact?: boolean; initialSaved?: boolean; initialQuery?: string; focusSearch?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const refreshRooms = useCallback(() => router.refresh(), [router]);
  useVisibleRefresh(refreshRooms);
  const [competition, setCompetition] = useState("all");
  const [date, setDate] = useState("all");
  const [tab, setTab] = useState(initialSaved ? "saved" : "all");
  const [saved, setSaved] = useState<string[]>([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [selectedId, setSelectedId] = useState(rooms[0]?.id || "");
  const [now, setNow] = useState<number | null>(null);
  const [carouselPlaying, setCarouselPlaying] = useState(true);
  const [carouselHover, setCarouselHover] = useState(false);
  const [carouselFocus, setCarouselFocus] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const detailsButtonRef = useRef<HTMLButtonElement>(null);
  const detailsCloseRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (focusSearch) searchRef.current?.focus(); }, [focusSearch]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("sober:saved-rooms") || "[]");
      if (Array.isArray(stored)) setSaved(stored.filter((id): id is string => typeof id === "string"));
    } catch { setStorageMessage("Saved matches are unavailable in this browser."); }
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (compact || initialSaved || !carouselPlaying || carouselHover || carouselFocus || detailsOpen || reducedMotion) return;
    const candidates = rooms.filter(room => competition === "all" || room.competition === competition).slice(0, 4);
    if (candidates.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSelectedId(current => {
        const index = candidates.findIndex(room => room.id === current);
        return candidates[(index + 1) % candidates.length].id;
      });
    }, 5600);
    return () => window.clearInterval(timer);
  }, [rooms, competition, compact, initialSaved, carouselPlaying, carouselHover, carouselFocus, detailsOpen, reducedMotion]);

  useEffect(() => {
    if (!detailsOpen) return;
    detailsCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailsOpen(false);
        window.requestAnimationFrame(() => detailsButtonRef.current?.focus());
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailsOpen]);

  const competitions = [...new Set(rooms.map(room => room.competition))];
  const dates = [...new Set(rooms.map(room => room.kickoffAt.slice(0, 10)))];
  const selected = rooms.find(room => room.id === selectedId) || rooms[0];
  const featuredRooms = rooms.filter(room => competition === "all" || room.competition === competition).slice(0, 4);
  const featuredIndex = featuredRooms.findIndex(room => room.id === selected?.id);
  const demo = rooms.length > 0 && rooms.every(room => room.demo);
  const visible = rooms.filter(room => {
    const text = `${room.homeTeam} ${room.awayTeam} ${room.competition}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (competition === "all" || room.competition === competition)
      && (date === "all" || room.kickoffAt.startsWith(date))
      && (tab !== "saved" || saved.includes(room.id))
      && (tab !== "upcoming" || now === null || new Date(room.kickoffAt).getTime() > now);
  });

  function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter(value => value !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem("sober:saved-rooms", JSON.stringify(next)); setStorageMessage(""); }
    catch { setStorageMessage("Your selection is saved for this visit only; browser storage is unavailable."); }
  }

  function resetFilters() { setQuery(""); setCompetition("all"); setDate("all"); setTab("all"); }

  function selectFeatured(id: string) {
    setSelectedId(id);
    setDetailsOpen(false);
    setCarouselPlaying(false);
  }

  function stepFeatured(direction: number) {
    if (featuredRooms.length < 2) return;
    const index = featuredIndex < 0 ? 0 : featuredIndex;
    selectFeatured(featuredRooms[(index + direction + featuredRooms.length) % featuredRooms.length].id);
  }

  function selectCompetition(value: string) {
    setCompetition(value);
    const first = rooms.find(room => value === "all" || room.competition === value);
    if (first) setSelectedId(first.id);
    setDetailsOpen(false);
  }

  function closeDetails() {
    setDetailsOpen(false);
    window.requestAnimationFrame(() => detailsButtonRef.current?.focus());
  }

  return <div className="football-dashboard">
    <div className="dashboard-heading"><div><div className="section-kicker">SOBER / FOOTBALL</div><h1>{initialSaved ? "Your saved matches" : compact ? "Match center" : "The next fixture"}</h1><p>Upcoming matches, the questions behind them, and your call before kickoff.</p></div><span className="football-only"><span className="football-symbol" aria-hidden="true">◉</span> Football only</span></div>

    {!compact && !initialSaved && <div className={`panta-feed-status ${pantaFeed}`} role="status"><span className="feed-indicator" aria-hidden="true"/><strong>{pantaFeed === "connected" ? "Panta market feed connected" : pantaFeed === "demo" ? "Preview mode" : pantaFeed === "unconfigured" ? "Panta API key needed" : pantaFeed === "unmapped" ? "Panta API configured" : "Panta feed unavailable"}</strong><span>{pantaFeed === "connected" ? "Market states appear when linked to reviewed Sober fixtures; kickoff times come from those fixtures." : pantaFeed === "demo" ? "The matches below are fictional; live Panta data is not displayed." : pantaFeed === "unconfigured" ? "Add PANTA_API_KEY and enable live mode to check linked markets." : pantaFeed === "unmapped" ? "No published match is linked to a Panta market yet." : "Market states could not be checked."}</span></div>}

    {!compact && !initialSaved && publicFixtures.length > 0 && <section className="public-fixtures" aria-labelledby="public-fixtures-title"><div className="public-fixtures-heading"><div><span className="section-kicker">PUBLIC SCHEDULE PREVIEW</span><h2 id="public-fixtures-title">Upcoming Premier League fixture</h2></div><a href="https://www.thesportsdb.com/documentation" target="_blank" rel="noreferrer">Source: TheSportsDB <ArrowUpRight size={15}/></a></div><div className="public-fixtures-list">{publicFixtures.map(fixture => <div className="public-fixture" key={fixture.id}><span>{fixture.competition}</span><strong>{fixture.homeTeam} <span>vs</span> {fixture.awayTeam}</strong><time dateTime={fixture.kickoffAt}>{dateLabel(fixture.kickoffAt)} · {timeLabel(fixture.kickoffAt)} UTC</time></div>)}</div><p>Real schedule data for discovery. Forecasts and Panta trades become available only after a host reviews and publishes a match room.</p></section>}
    {!compact && !initialSaved && publicFixtureError && <div className="public-fixtures public-fixtures-error" role="status"><strong>Public schedule unavailable</strong><p>The fixture source could not be reached. Reload the page to try again.</p></div>}

    {!compact && selected && <section className={`match-feature ${detailsOpen ? "details-open" : ""}`} aria-label="Featured fixture" onMouseEnter={() => setCarouselHover(true)} onMouseLeave={() => setCarouselHover(false)} onFocusCapture={() => setCarouselFocus(true)} onBlurCapture={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setCarouselFocus(false); }}>
      <div className="feature-atmosphere" aria-hidden="true"><span/><span/><span/></div>
      <div className="match-feature-shade"/>
      <div className="match-feature-topline" inert={detailsOpen}><span className="match-feature-status"><span aria-hidden="true"/>{selected.demo ? "Demo fixture" : selected.pantaPhase ? `Panta · ${selected.pantaPhase}` : selected.pantaMarketId ? "Panta mapping pending" : "Forecast room"}</span><span className="match-feature-competition"><Trophy size={14}/>{selected.competition}{selected.demo && <span>Demo</span>}</span></div>
      <div key={`content-${selected.id}`} className="match-feature-main" inert={detailsOpen}>
        <div className="match-feature-matchup"><div className="featured-team"><TeamBadge name={selected.homeTeam}/><strong>{selected.homeTeam}</strong></div><div className="featured-divider"><span>UPCOMING MATCH</span><strong>VS</strong><small>{dateLabel(selected.kickoffAt)} · {timeLabel(selected.kickoffAt)} UTC</small></div><div className="featured-team away"><TeamBadge name={selected.awayTeam} away/><strong>{selected.awayTeam}</strong></div></div>
        <div className="match-feature-question"><span>THE MATCH QUESTION</span><h2>{selected.question || "Match question will be published soon."}</h2><div className="feature-actions"><Link className="button-primary" href={`/matches/${selected.id}`}>Open match room <ArrowUpRight size={16}/></Link><button ref={detailsButtonRef} type="button" className="feature-details-button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(true)}>Match details <ChevronRight size={16}/></button></div></div>
      </div>
      <div className="match-feature-footer" inert={detailsOpen}><div className="feature-pagination"><span className="feature-count">{featuredIndex < 0 ? "SELECTED" : `${String(featuredIndex + 1).padStart(2, "0")} / ${String(featuredRooms.length).padStart(2, "0")}`}</span>{featuredRooms.length > 1 && <div className="feature-dots">{featuredRooms.map((room, index) => <button key={room.id} type="button" aria-label={`Show fixture ${index + 1}: ${room.homeTeam} versus ${room.awayTeam}`} aria-pressed={selected.id === room.id} onClick={() => selectFeatured(room.id)}><span/></button>)}</div>}</div>{featuredRooms.length > 1 && <div className="feature-controls"><button type="button" aria-label="Previous featured fixture" onClick={() => stepFeatured(-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="Next featured fixture" onClick={() => stepFeatured(1)}><ChevronRight size={18}/></button>{!reducedMotion && <button type="button" aria-label={carouselPlaying ? "Pause fixture carousel" : "Play fixture carousel"} aria-pressed={!carouselPlaying} onClick={() => { setCarouselPlaying(value => !value); setCarouselHover(false); setCarouselFocus(false); }}>{carouselPlaying ? <Pause size={17}/> : <Play size={17}/>}</button>}</div>}</div>
      {detailsOpen && <><button type="button" className="feature-details-backdrop" tabIndex={-1} aria-hidden="true" onClick={closeDetails}/><aside className="feature-details-panel" role="dialog" aria-modal="true" aria-label="Match details" onKeyDown={event => { if (event.key !== "Tab") return; const first = detailsCloseRef.current; const last = event.currentTarget.querySelector<HTMLAnchorElement>("a[href]"); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }}><div className="feature-details-head"><span>Match details</span><button ref={detailsCloseRef} type="button" aria-label="Close match details" onClick={closeDetails}><X size={19}/></button></div><div className="feature-details-content"><span className="feature-details-kicker">{selected.competition} · {dateLabel(selected.kickoffAt)} · {timeLabel(selected.kickoffAt)} UTC</span><div className="feature-details-teams"><div><TeamBadge name={selected.homeTeam}/><strong>{selected.homeTeam}</strong></div><span>VS</span><div><TeamBadge name={selected.awayTeam} away/><strong>{selected.awayTeam}</strong></div></div><div className="feature-details-section"><span>Fixture brief</span><p>{selected.brief || "The fixture brief will be published in the match room."}</p></div><div className="feature-details-section"><span>Resolution rule</span><p>{selected.resolutionRule || "Resolution rules will be published in the match room."}</p></div><Link href={`/matches/${selected.id}`}>Read the full match room <ArrowUpRight size={15}/></Link></div></aside></>}
    </section>}

    <div className="dashboard-grid">
      <section className="fixtures-panel" id="match-center" aria-labelledby="fixtures-title">
        <div className="panel-title"><div><Trophy size={19}/><h2 id="fixtures-title">Match center</h2><span className="number-tag">{rooms.length}</span></div><span className="timezone">All times UTC</span></div>
        {demo && <div className="demo-data-note"><span>Demo fixtures</span> Fictional teams and schedules. No live scores or real odds.</div>}
        <div className="fixture-tabs" role="group" aria-label="Filter matches">{[{ id: "all", label: "All matches" }, { id: "upcoming", label: "Upcoming" }, { id: "saved", label: "Saved" }].map(item => <button key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.id === "saved" && <Bookmark size={14}/>} {item.label}{item.id === "saved" && <span>{rooms.filter(room => saved.includes(room.id)).length}</span>}</button>)}</div>
        <div className="competition-strip" role="group" aria-label="Filter by competition"><button aria-pressed={competition === "all"} className={competition === "all" ? "active" : ""} onClick={() => selectCompetition("all")}>All fixtures <span>{rooms.length}</span></button>{competitions.map(value => <button key={value} aria-pressed={competition === value} className={competition === value ? "active" : ""} onClick={() => selectCompetition(value)}>{value}<span>{rooms.filter(room => room.competition === value).length}</span></button>)}</div>
        <div className="fixture-filters"><label className="fixture-search"><Search size={16}/><span className="sr-only">Search team or competition</span><input ref={searchRef} type="search" placeholder="Search teams..." value={query} onChange={event => setQuery(event.target.value)}/>{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={15}/></button>}</label><label className="date-filter"><CalendarDays size={15}/><span className="sr-only">Match date</span><select value={date} onChange={event => setDate(event.target.value)}><option value="all">All dates</option>{dates.map(value => <option key={value} value={value}>{dateLabel(value)}</option>)}</select></label></div>
        <div className="fixture-results" aria-live="polite"><span>{visible.length} {visible.length === 1 ? "match" : "matches"}</span>{(query || competition !== "all" || date !== "all") && <button onClick={resetFilters}>Reset filters</button>}</div>
        {failed ? <div className="dashboard-empty"><h3>Matches could not be loaded</h3><p>Please reload to try again.</p><button className="button-secondary" onClick={() => window.location.reload()}>Reload matches</button></div> : visible.length === 0 ? <div className="dashboard-empty"><Bookmark size={25}/><h3>{tab === "saved" ? "Your matchday list starts here" : rooms.length ? "No matching fixtures" : "No published match rooms yet"}</h3><p>{tab === "saved" ? "Save a match with the bookmark button to find it here." : rooms.length ? "Try another team, competition, or date." : "The host must review a real fixture, publish its rules, and link a Panta market before it appears here."}</p>{rooms.length > 0 && <button className="button-secondary" onClick={resetFilters}>Show all matches</button>}</div> : <div className="fixture-list">{visible.map(room => <article className={`fixture-row ${selectedId === room.id ? "selected" : ""}`} key={room.id}>
          <div className="fixture-meta"><span>{room.competition}</span><span>{dateLabel(room.kickoffAt)}{room.demo && <span className="fixture-demo">Demo</span>}</span></div>
          <div className="fixture-match"><div className="fixture-time"><strong>{timeLabel(room.kickoffAt)}</strong><span>UTC</span></div><Link className="fixture-teams" href={`/matches/${room.id}`}><span><TeamBadge name={room.homeTeam}/><strong>{room.homeTeam}</strong></span><span><TeamBadge name={room.awayTeam} away/><strong>{room.awayTeam}</strong></span></Link><div className="fixture-status"><span>{room.demo ? "Preview room" : room.pantaPhase ? `Panta · ${room.pantaPhase}` : room.pantaMarketId ? "Market check pending" : "Forecast only"}</span><button className="match-preview" aria-label={`Preview ${room.homeTeam} versus ${room.awayTeam}`} aria-pressed={selectedId === room.id} onClick={() => selectFeatured(room.id)}>Details <ChevronRight size={15}/></button></div><button className={`save-match ${saved.includes(room.id) ? "saved" : ""}`} aria-label={`${saved.includes(room.id) ? "Unsave" : "Save"} ${room.homeTeam} versus ${room.awayTeam}`} aria-pressed={saved.includes(room.id)} onClick={() => toggleSaved(room.id)}><Bookmark size={18} fill={saved.includes(room.id) ? "currentColor" : "none"}/></button></div>
        </article>)}</div>}
        {storageMessage && <p className="storage-message" role="status">{storageMessage}</p>}
        <div className="fixture-footer"><ShieldCheck size={15}/><span>A fan forecast is free. A trade always needs your wallet approval.</span></div>
      </section>

      <aside className="match-sidebar" aria-label="Matchday sidebar">
        {!compact && !initialSaved && featuredRooms.length > 0 ? <section className="spotlight-panel feature-queue"><div className="panel-title"><div><span className="section-kicker">ON THE BOARD</span><h2>Featured fixtures</h2></div><span className="queue-count">{featuredRooms.length.toString().padStart(2, "0")}</span></div><div className="feature-queue-list">{featuredRooms.map((room, index) => <button key={room.id} type="button" className={selected?.id === room.id ? "active" : ""} aria-pressed={selected?.id === room.id} onClick={() => selectFeatured(room.id)}><span className="queue-index">{String(index + 1).padStart(2, "0")}</span><span className="queue-teams"><strong>{room.homeTeam}</strong><span>vs {room.awayTeam}</span></span><span className="queue-time">{timeLabel(room.kickoffAt)}<small>UTC</small></span></button>)}</div><p className="queue-note">Select a fixture to bring it into focus.</p></section> : selected && <section className="spotlight-panel context-panel"><div className="panel-title"><div><span className="section-kicker">MATCH DETAIL</span><h2>Match context</h2></div><span className="spotlight-mark"><span/>Selected</span></div><div className="spotlight-competition"><Trophy size={14}/>{selected.competition}{selected.demo && <span>Demo</span>}</div><div className="context-copy"><span>Fixture brief</span><p>{selected.brief}</p></div><div className="context-rule"><span>Resolution rule</span><p>{selected.resolutionRule || "Resolution rules will be published in the match room."}</p></div><Link className="button-primary full" href={`/matches/${selected.id}`}>Review match room <ArrowUpRight size={17}/></Link><p className="spotlight-note">Forecast access and market status are shown in the match room.</p></section>}
        <section className="matchday-note"><div className="pitch-mini" aria-hidden="true"><span/><i/></div><span className="section-kicker">Before the whistle</span><h2>Your call.<br/>Your reasons.</h2><p>A good prediction starts with context. Read the brief and save your view before kickoff.</p>{selected && <Link href={`/matches/${selected.id}`}>Open forecast room <ArrowRight size={15}/></Link>}</section>
        <div className="dashboard-panta"><span>Markets powered by <a href="https://www.panta.market/" target="_blank" rel="noreferrer">Panta <ArrowUpRight size={12}/></a></span><p>Market availability is shown in each room.</p></div>
      </aside>
    </div>
  </div>;
}
