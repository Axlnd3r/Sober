"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Search, X, RefreshCw, ArrowRight } from "lucide-react";
import { MatchAnalyst } from "@/components/MatchAnalyst";
import { marketWindow, type CatalogFeed } from "@/lib/market-display";
import { priceCents, type CinemaFixture, type CinemaRoom, type DrawerTab, type HeroSlide, type MarketSelection } from "./types";
import { TeamBadge } from "./TeamBadge";
import { isActiveMarket } from "@/lib/football-market-core";

const tabs: { id: DrawerTab; label: string }[] = [{ id: "markets", label: "Markets" }, { id: "analyst", label: "Analysis" }, { id: "fixture", label: "Fixture" }, { id: "story", label: "Story" }];
type Props = {
  tab: DrawerTab | null; onTab: (tab: DrawerTab) => void; onClose: () => void;
  feed: CatalogFeed; fixture: CinemaFixture | null; rooms: CinemaRoom[]; slide: HeroSlide;
  query: string; onQuery: (query: string) => void; refresh: () => void; busy: boolean; error: string;
  selection: MarketSelection | null; onSelection: (selection: MarketSelection | null) => void;
};
export function MatchDrawer({ tab, onTab, onClose, feed, fixture, rooms, slide, query, onQuery, refresh, busy, error, selection, onSelection }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [now, setNow] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const open = tab !== null;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { trigger.current = document.activeElement as HTMLElement; dialog.showModal(); setNow(Date.now()); }
    if (!open && dialog.open) { dialog.close(); trigger.current?.focus(); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const markets = feed.markets.filter(m => (showHistory || isActiveMarket(m, now)) && m.title.toLowerCase().includes(query.toLowerCase()));
  const selectedMarket = feed.markets.find(m => m.marketId === selection?.marketId);
  const selectedRoom = selection ? rooms.find(room => room.pantaMarketId === selection.marketId) : null;
  return <dialog ref={ref} className="cinema-drawer" aria-label="Match and market details" onCancel={onClose} onClick={event => {
    if (event.target !== ref.current) return;
    const box = ref.current.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    <div className="cinema-drawer-top"><span>sober<span className="cinema-drawer-brand-dot">.</span> <small>MATCHDAY</small></span><button aria-label="Close details" onClick={onClose}><X size={18}/></button></div>
    <div className="cinema-drawer-tabs" role="tablist" aria-label="Match details" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = tabs.findIndex(item => item.id === tab);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      onTab(tabs[next].id);
      document.getElementById(`cinema-tab-${tabs[next].id}`)?.focus();
    }}>{tabs.map(item => <button id={`cinema-tab-${item.id}`} type="button" key={item.id} role="tab" aria-selected={tab === item.id} aria-controls={`cinema-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => onTab(item.id)}>{item.label}</button>)}</div>
    {tab && <div className="cinema-drawer-content" role="tabpanel" id={`cinema-panel-${tab}`} aria-labelledby={`cinema-tab-${tab}`} tabIndex={0} key={tab}>
      {tab === "markets" && <>
        <div className="cinema-drawer-heading"><div><span className="cinema-drawer-kicker">PANTA / SPORTS</span><h2>Pick your perspective.</h2></div><button className="cinema-refresh" onClick={refresh} disabled={busy} aria-label="Refresh Panta prices"><RefreshCw size={16} className={busy ? "is-refreshing" : ""}/></button></div>
        <div className="cinema-feed-status" role="status"><span className={feed.status === "connected" ? "is-connected" : ""}/>{busy ? "Refreshing prices…" : feed.status === "connected" ? `Panta API connected · ${new Date(feed.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : feed.message}</div>
        {error && <p className="cinema-drawer-error" role="alert">{error}</p>}
        <label className="cinema-market-search"><Search size={15}/><span className="sr-only">Search Panta markets</span><input type="search" placeholder="Search teams or markets" value={query} onChange={event => onQuery(event.target.value)}/></label>
        <div className="cinema-market-scope" aria-label="Market activity filter"><button aria-pressed={!showHistory} onClick={() => setShowHistory(false)}>Active markets</button><button aria-pressed={showHistory} onClick={() => setShowHistory(true)}>Include history</button></div>
        {selectedMarket && selection && <section className="cinema-selection" aria-label="Selected market"><div><span>YOUR SELECTION</span><button aria-label="Clear selection" onClick={() => onSelection(null)}><X size={14}/></button></div><h3>{selectedMarket.title}</h3><p><strong>{selection.side}</strong> {priceCents(selection.side === "YES" ? selectedMarket.yesPrice : selectedMarket.noPrice)} <span>per share</span></p>{selectedRoom ? <Link href={`/matches/${selectedRoom.id}`} className="cinema-drawer-action">Review in match room <ArrowRight size={15}/></Link> : <p className="cinema-selection-note">This market has no published Sober match room yet. You can explore its prices; trading opens after host review.</p>}<small>Selecting a side does not place an order.</small></section>}
        <div className="cinema-market-list">{markets.map(market => <article key={market.marketId} className="cinema-market-row"><span className="cinema-market-phase">{marketWindow(market, now)}</span><h3>{market.title}</h3><div className="cinema-market-options">{(["YES", "NO"] as const).map(side => <button key={side} className={selection?.marketId === market.marketId && selection.side === side ? "is-selected" : ""} aria-pressed={selection?.marketId === market.marketId && selection.side === side} onClick={() => onSelection({ marketId: market.marketId, side })}><span>{side}</span><strong>{priceCents(side === "YES" ? market.yesPrice : market.noPrice)}</strong></button>)}</div><details><summary>Resolution & market details</summary><p>{market.description || "No description supplied. Review full resolution rules before trading."}</p><small>Market ID</small><code>{market.marketId}</code><p>Price source: {market.priceSource || "Not supplied"}</p></details></article>)}</div>
        {markets.length === 0 && <div className="cinema-drawer-empty"><h3>{query ? `No markets for “${query}”` : "No sports markets loaded"}</h3><p>{query ? "Try another club or browse the full sports feed." : feed.message}</p><button onClick={query ? () => onQuery("") : refresh}>{query ? "Show all markets" : "Retry connection"}</button></div>}
        <p className="cinema-drawer-footnote">Prices are in USDC cents per share. Market prices are not AI predictions.</p><Link className="cinema-drawer-link" href="/markets">Browse the full feed <ArrowUpRight size={13}/></Link>
      </>}
      {tab === "analyst" && <><span className="cinema-drawer-kicker">FORM / HISTORY / CONTEXT</span>{fixture?.roomId ? <MatchAnalyst roomId={fixture.roomId}/> : <><h2>The story in the stats.</h2><p className="cinema-drawer-intro">A pre-match brief, grounded in completed fixtures.</p><div className="cinema-analysis-list"><div><span>01</span><div><h3>Recent form</h3><p>Results, goals scored and conceded, and points per match.</p></div></div><div><span>02</span><div><h3>Home & away</h3><p>Venue splits and the time between matches.</p></div></div><div><span>03</span><div><h3>Evidence for both sides</h3><p>Source-linked reasons supporting YES and NO, with gaps made explicit.</p></div></div></div><div className="cinema-analysis-pending"><strong>Brief not published yet</strong><p>The host needs to publish a reviewed match room with team history before analysis is available for this fixture.</p></div><Link className="cinema-drawer-action" href="/matches">Open match centre <ArrowRight size={15}/></Link></>}<p className="cinema-drawer-footnote">The analyst selects evidence. It does not guarantee an outcome.</p></>}
      {tab === "fixture" && <><span className="cinema-drawer-kicker">{fixture?.marketId ? "DISCOVERED ON PANTA" : "THE NEXT FIXTURE"}</span><h2>{fixture?.competition || "Football schedule"}</h2>{fixture ? <>
        <div className="cinema-fixture-teams"><div><TeamBadge team={fixture.homeAsset} name={fixture.homeTeam}/><strong>{fixture.homeTeam}</strong></div><span>vs</span><div><TeamBadge team={fixture.awayAsset} name={fixture.awayTeam}/><strong>{fixture.awayTeam}</strong></div></div>
        {fixture.marketQuestion && <p className="cinema-fixture-question">{fixture.marketQuestion}</p>}
        <dl className="cinema-fixture-facts"><div><dt>Kickoff</dt><dd>{fixture.kickoffAt ? `${new Date(fixture.kickoffAt).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "Not confirmed by the schedule provider"}</dd></div>
          {!fixture.kickoffAt && fixture.marketEndsAt && <div><dt>Market closes</dt><dd>{new Date(fixture.marketEndsAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</dd></div>}
          <div><dt>Match room</dt><dd>{fixture.roomId ? "Published" : "Awaiting host review"}</dd></div><div><dt>Match source</dt><dd>{fixture.roomId ? "Reviewed fixture" : fixture.sourceKind === "panta" ? "Panta market question" : "TheSportsDB public schedule"}</dd></div><div><dt>Club artwork</dt><dd>TheSportsDB{!fixture.homeAsset?.badgeUrl || !fixture.awayAsset?.badgeUrl ? " / initials fallback" : ""}</dd></div>
        </dl><a className="cinema-drawer-link" href={fixture.sourceUrl} target="_blank" rel="noreferrer">{fixture.sourceKind === "panta" ? "Open Panta" : "View fixture source"} <ArrowUpRight size={13}/></a>
        <div className="cinema-team-sources">{[fixture.homeAsset, fixture.awayAsset].map(asset => asset?.sourceUrl ? <a key={asset.id} href={asset.sourceUrl} target="_blank" rel="noreferrer">{asset.name} badge source <ArrowUpRight size={11}/></a> : null)}</div>
        <Link href={fixture.roomId ? `/matches/${fixture.roomId}` : "/matches"} className="cinema-drawer-action">{fixture.roomId ? "Enter match room" : "Open match centre"} <ArrowRight size={15}/></Link><p className="cinema-drawer-footnote">Teams follow Panta's market question. A market close time is not a confirmed kickoff. Athlete photography is illustrative.</p>
      </> : <div className="cinema-drawer-empty"><p>The upcoming schedule is temporarily unavailable.</p><Link href="/matches">Open match centre</Link></div>}</>}
      {tab === "story" && <article className="cinema-story"><span className="cinema-drawer-kicker">THE SOBER NOTEBOOK</span><h2>{slide.story.heading}</h2><img src={slide.image} alt={slide.imageAlt} width={600} height={400}/><span className="cinema-story-byline">Sober editorial · Reading the game</span>{slide.story.paragraphs.map(text => <p key={text}>{text}</p>)}<button className="cinema-drawer-action" onClick={() => onTab(slide.id === "market" ? "markets" : "analyst")}>{slide.id === "market" ? "Explore the market" : "Open match analysis"} <ArrowRight size={15}/></button><p className="cinema-drawer-footnote">Editorial context, not a team-specific statistical forecast. Photo: AI-generated fictional athletes.</p></article>}
    </div>}
    <div className="cinema-drawer-attribution">Market infrastructure by <a href="https://www.panta.market/" target="_blank" rel="noreferrer">Panta <ArrowUpRight size={11}/></a></div>
  </dialog>;
}
