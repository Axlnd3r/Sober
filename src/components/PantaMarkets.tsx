"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { marketPrice, marketWindow, type CatalogFeed, type CatalogMarket } from "@/lib/market-display";

export function PantaMarkets({ compact = false, onSelect }: { compact?: boolean; onSelect?: (market: CatalogMarket) => void }) {
  const [feed, setFeed] = useState<CatalogFeed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("all");
  const [now, setNow] = useState(Date.now());
  const refreshing = useRef(false);
  const load = useCallback(async (cursor = "") => {
    if (refreshing.current) return;
    refreshing.current = true;
    setBusy(true); setError("");
    try {
      const next = await api<CatalogFeed>(`/api/panta/markets${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (next.status === "unavailable" && cursor) { setError(next.message); return; }
      setFeed(previous => cursor && previous ? { ...next, scanned: previous.scanned + next.scanned,
        markets: [...new Map([...previous.markets, ...next.markets].map(m => [m.marketId, m])).values()] } : next);
      setNow(Date.now());
    } catch { setError("Panta market data could not be loaded. Try again."); }
    finally { refreshing.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    void load();
    const update = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [load]);
  const markets = (feed?.markets || []).filter(m => (phase === "all" || m.phase === phase) && `${m.title} ${m.marketId}`.toLowerCase().includes(query.toLowerCase()));
  return <section className={`panta-discovery ${compact ? "compact" : ""}`} aria-label="Panta sports markets">
    <div className="panta-discovery-heading"><div><h2>{compact ? "Connected to the market" : "Panta sports markets"}</h2><p>{feed?.status === "connected" ? `Panta API connected · Checked ${new Date(feed.checkedAt).toLocaleTimeString()} · ${feed.markets.length} titled markets` : feed?.message || "Connecting to Panta…"}</p></div>
      {compact ? <Link className="button-secondary" href="/markets">Explore markets</Link> : <button className="button-secondary" disabled={busy} onClick={() => void load()}>{busy ? "Refreshing…" : "Refresh markets"}</button>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!feed && busy && <p role="status">Loading sports markets from Panta…</p>}
    {feed?.status === "connected" && <>
      {!compact && <div className="catalog-filters"><label>Search sports markets<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Team, question or market ID"/></label><label>Market phase<select value={phase} onChange={e => setPhase(e.target.value)}><option value="all">All phases</option><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="resolved">Resolved</option></select></label></div>}
      <div className="catalog-list">{(compact ? markets.slice(0, 2) : markets).map(market => <article className="catalog-row" key={market.marketId}>
        <div><span className="catalog-phase">{marketWindow(market, now)}</span><h3>{market.title}</h3>{!compact && <details><summary>Market details</summary><p>{market.description || "Panta has not supplied a description. Review the full resolution rules before mapping."}</p><p className="break-anywhere">Market ID: {market.marketId}</p>{market.endTime && <p>Market closes: {new Date(market.endTime * 1000).toLocaleString()}</p>}<p>Price source: {market.priceSource || "Not supplied"} · Valuation: {market.valuationStatus || "Not supplied"}</p>{onSelect && <button type="button" className="button-secondary" onClick={() => onSelect(market)}>Select for mapping review</button>}</details>}</div>
        <dl className="catalog-prices"><div><dt>YES price</dt><dd>{marketPrice(market.yesPrice)}</dd></div><div><dt>NO price</dt><dd>{marketPrice(market.noPrice)}</dd></div></dl>
      </article>)}</div>
      {!markets.length && <p role="status">No sports markets match this page and filter. {feed.nextCursor ? "Load the next page to search more markets." : "Try another filter or check back later."}</p>}
      {!compact && feed.nextCursor && <button className="button-secondary" disabled={busy} onClick={() => void load(feed.nextCursor!)}>{busy ? "Loading…" : "Load more markets"}</button>}
      <p className="catalog-note">Panta entries without a published question are hidden. “Not quoted” means a current price was unavailable in this catalog check. Prices, when available, are USDC per share and are not model predictions. Trading in Sober requires a reviewed match room.</p>
    </>}
    {(error || feed?.status === "unavailable") && compact && <button className="button-secondary" disabled={busy} onClick={() => void load()}>Retry connection</button>}
    <p className="catalog-attribution">Powered by <a href="https://www.panta.market/" target="_blank" rel="noreferrer">Panta</a></p>
  </section>;
}
