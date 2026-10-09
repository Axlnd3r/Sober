"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ExternalLink, Info, Link2, ShieldCheck, X } from "lucide-react";
import { api, post } from "@/lib/client-api";
import { compileInstructions, type BuiltInstruction } from "@/lib/client-solana";
import type { Room } from "@/lib/rooms";
import { formatKickoff } from "./MatchCard";
import { useSoberSession } from "./Shell";
import { MatchAnalyst } from "./MatchAnalyst";
import { ForecastReceipt } from "./ForecastReceipt";
import { captureDecision, forecastDeadline, type SavedForecast } from "@/lib/forecast-receipt";
import { readLocalForecast } from "@/lib/local-forecast";
import { useVisibleRefresh } from "@/hooks/useVisibleRefresh";
import { marketPrice } from "@/lib/market-display";

type Market = { marketId: string; phase: string; yesPrice?: string | null; noPrice?: string | null; primaryYesPrice?: string | null; primaryNoPrice?: string | null };
type RoomData = { room: Room; market: Market | null; marketError: string | null; buyUnavailableReason: string | null; fetchedAt: string };
type ForecastData = { yes: number; no: number; reasons: { side: string; reason: string; updatedAt: string; alias: string }[]; mine: SavedForecast | null; demo: boolean };
type Quote = { quoteId: string; marketId: string; side: "yes" | "no"; amountUsdc: string; shares: string; avgPrice: string; feeUsdc: string; expiresAt: string };
type Build = { orderId: string; quoteId: string; wallet: string; marketId: string; side: string; instructions: BuiltInstruction[]; recentBlockhash: string; lastValidBlockHeight?: number; expiresAt?: string };
type Status = { state: string; signature: string; chainStatus: string; pantaStatus: string; attributionStatus: string };

export function MatchRoom({ id }: { id: string }) {
  const [data, setData] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [tradeOpen, setTradeOpen] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const loadedRoom = useRef<string | null>(null);
  const draftDirty = useRef(false);
  const draftRoom = useRef(id);
  const draftOwner = useRef<string | null>(null);
  const { session, mode } = useSoberSession();
  const wallet = useWallet();
  const signedIn = Boolean(session?.wallet && wallet.publicKey && session.wallet === wallet.publicKey.toBase58());
  const load = useCallback(async (resetDraft = false) => {
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController(); request.current = controller;
    setRefreshing(true);
    try {
      const next = await api<RoomData>(`/api/rooms/${encodeURIComponent(id)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      loadedRoom.current = id;
      setData(next); setError(""); setRefreshError(""); setNow(Date.now());
      try {
        const votes = await api<ForecastData>(`/api/forecasts?roomId=${encodeURIComponent(id)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const mine = votes.demo ? readLocalForecast(id) : signedIn ? votes.mine : null;
        setForecast({ ...votes, mine }); setForecastError("");
        if (resetDraft && !draftDirty.current) { setSide(mine?.side || "yes"); setReason(mine?.reason || ""); }
      } catch { if (!controller.signal.aborted) setForecastError("Fan forecasts could not be refreshed. The saved record below is from the last successful check."); }
    } catch (cause) {
      if (controller.signal.aborted) return;
      const message = cause instanceof Error ? cause.message : "Could not load match room";
      if (loadedRoom.current !== id) setError(message);
      else setRefreshError("Room update failed. Recheck before requesting a trade.");
    } finally {
      if (request.current === controller && !controller.signal.aborted) { request.current = null; setRefreshing(false); }
    }
  }, [id, signedIn, session?.wallet]);
  useEffect(() => {
    const owner = signedIn ? session!.wallet : null;
    const roomChanged = draftRoom.current !== id;
    const ownerChanged = draftOwner.current !== null && draftOwner.current !== owner;
    request.current?.abort(); setForecast(null); setSaved(""); setError(""); setForecastError(""); setRefreshError("");
    if (roomChanged) { setData(null); loadedRoom.current = null; }
    if (roomChanged || ownerChanged) { draftDirty.current = false; setReason(""); setSide("yes"); }
    draftRoom.current = id; draftOwner.current = owner;
    void load(!draftDirty.current);
    return () => request.current?.abort();
  }, [load]);
  const refresh = useCallback(() => { void load(); }, [load]);
  useVisibleRefresh(refresh, !saving);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (session && mode === "live" && data?.room.id === id) void post("/api/events", { roomId: id, event: "room_view" }).catch(() => undefined); }, [id, session?.wallet, mode, data?.room.id]);
  useEffect(() => { if (session && mode === "live" && analysisId) void post("/api/events", { roomId: id, event: "analysis_view" }).catch(() => undefined); }, [id, session?.wallet, mode, analysisId]);
  async function saveForecast() {
    if (!data || reason.trim().length < 3 || reason.length > 280) return;
    const cutoff = forecast?.mine ? forecastDeadline(forecast.mine, data.room.cutoffAt) : Date.parse(data.room.cutoffAt);
    if (Date.now() >= cutoff) { setSaved("Forecast cutoff has passed."); return; }
    request.current?.abort(); setRefreshing(false);
    setSaving(true); setSaved("");
    try {
      let mine: SavedForecast;
      if (mode === "simulation") {
        const savedAt = new Date().toISOString();
        const snapshot = captureDecision(data.room, null);
        snapshot.cutoffAt = new Date(cutoff).toISOString();
        mine = { side, reason: reason.trim(), analysis_id: null, created_at: forecast?.mine?.created_at || savedAt, updated_at: savedAt, decision_snapshot: snapshot };
        localStorage.setItem(`sober:demo-forecast:${id}`, JSON.stringify(mine));
        setSaved("Practice forecast saved on this device. No trade placed.");
      } else {
        mine = await post<SavedForecast>("/api/forecasts", { roomId: id, side, reason: reason.trim(), analysisId });
        setSaved("Forecast saved to your notebook. No trade placed.");
      }
      setForecast(previous => ({ yes: previous?.yes || 0, no: previous?.no || 0, reasons: previous?.reasons || [], demo: mode === "simulation", mine }));
      draftDirty.current = false;
      setSide(mine.side); setReason(mine.reason);
      await load();
    } catch (e) { setSaved(e instanceof Error ? e.message : "Could not save forecast"); }
    finally { setSaving(false); }
  }
  async function share() { try { await navigator.clipboard.writeText(window.location.href); setSaved("Match link copied."); if (session && mode === "live") void post("/api/events", { roomId: id, event: "share" }).catch(() => undefined); } catch { setSaved("Could not copy the link."); } }
  if (error) return <div className="container room-loading"><h1>Match room unavailable</h1><p>{error}</p><button className="button-primary" disabled={refreshing} onClick={() => void load(true)}>Try again</button></div>;
  if (!data) return <div className="container room-loading"><div className="skeleton large"/><div className="skeleton"/><div className="skeleton"/></div>;
  const { room, market } = data;
  const cutoffPassed = now >= (forecast?.mine ? forecastDeadline(forecast.mine, room.cutoffAt) : Date.parse(room.cutoffAt));
  const stale = now - Date.parse(data.fetchedAt) > 90_000;
  const tradeData = { ...data, buyUnavailableReason: now >= Date.parse(room.cutoffAt) ? "Predictions closed before kickoff" : refreshError || stale ? "Refresh match data before requesting a trade" : data.buyUnavailableReason };
  const totalVotes = (forecast?.yes || 0) + (forecast?.no || 0);
  return <div className="room-page"><div className="container"><div className="room-topline"><Link href="/matches"><ArrowLeft size={16}/> All matches</Link><button onClick={() => void share()}><Link2 size={16}/> Copy room link</button></div>
    <div className="room-data-status"><p>{refreshError || data.marketError || (stale ? "Update overdue. Displayed information may be out of date." : `Checked ${new Date(data.fetchedAt).toLocaleTimeString()} · Refreshes every minute while visible`)}</p><button className="button-secondary" disabled={refreshing || saving} onClick={() => void load()}>{refreshing ? "Checking…" : "Refresh match data"}</button></div>
    <div className="room-hero"><div className="eyebrow">{room.competition} <span className="separator">/</span> MATCH ROOM</div><div className="room-scoreline"><div><span className="hero-monogram">{room.homeTeam[0]}</span><h1>{room.homeTeam}</h1></div><span className="room-vs">VS</span><div><span className="hero-monogram away">{room.awayTeam[0]}</span><h1>{room.awayTeam}</h1></div></div><div className="room-hero-meta"><span><Clock3 size={17}/> {formatKickoff(room.kickoffAt)}</span><span className={`status-pill ${room.demo ? "sample" : market ? "mapped" : "unavailable"}`}>{room.demo ? "FICTIONAL DEMO" : market ? `PANTA: ${market.phase.toUpperCase()}` : "MARKET UNAVAILABLE"}</span></div></div>
    <div className="room-grid"><div className="room-main">
      <section className="content-panel brief-panel"><div className="panel-head"><span className="eyebrow">01 / MATCH CONTEXT</span><h2>Before you pick a side</h2></div><p className="lead-copy">{room.brief}</p>{room.fixtureSourceUrl ? <a className="source-link" href={room.fixtureSourceUrl} target="_blank" rel="noreferrer">Fixture source <ExternalLink size={14}/></a> : <span className="source-note">Fictional fixture for interface demonstration.</span>}</section>
      <MatchAnalyst key={id} roomId={id} onAnalysis={setAnalysisId} savedSnapshotId={forecast?.mine?.analysis_id}/>
      <section className="content-panel rules-panel"><div className="panel-head"><span className="eyebrow">02 / THE QUESTION</span><h2>{room.question || "Market question pending"}</h2></div><div className="outcomes"><div className="outcome yes"><span>YES</span><strong>{room.homeTeam} win</strong><p>Regular time, including stoppage time.</p></div><div className="outcome no"><span>NO</span><strong>Draw or {room.awayTeam} win</strong><p>Regular time, including stoppage time.</p></div></div><p className="rule-note"><Info size={16}/> Extra time and penalty shootouts do not count. Fan forecasts close {formatKickoff(room.cutoffAt)}.</p><details><summary>Full resolution rule</summary><p>{room.resolutionRule || "The host has not published a resolution rule."}</p>{room.sources.map(source => <a key={source} className="source-link" href={source} target="_blank" rel="noreferrer">Resolution source <ExternalLink size={13}/></a>)}</details></section>
      <section className="content-panel signal-panel"><div className="panel-head"><span className="eyebrow">03 / FAN SIGNAL</span><h2>What fans called</h2></div><p className="muted">Wallet forecasts, separate from Panta market prices.</p>{forecastError ? <div className="signal-empty" role="status">{forecastError}</div> : totalVotes > 0 ? <><div className="signal-bar"><span style={{ width: `${(forecast!.yes / totalVotes) * 100}%` }}/></div><div className="signal-labels"><span>YES {Math.round(forecast!.yes / totalVotes * 100)}%</span><span>NO {Math.round(forecast!.no / totalVotes * 100)}%</span></div><p className="small-muted">{totalVotes} wallet {totalVotes === 1 ? "forecast" : "forecasts"}</p></> : <div className="signal-empty">No fan forecasts yet. Your view can be the first.</div>}
        <div className="forecast-form"><h3>Your pre-match call</h3><p className="muted">This is free. Saving a forecast never buys a position.</p>
          <div className="side-toggle" role="group" aria-label="Forecast side"><button className={side === "yes" ? "selected yes" : ""} disabled={cutoffPassed || saving} onClick={() => { draftDirty.current = true; setSide("yes"); }}>YES · Home win</button><button className={side === "no" ? "selected no" : ""} disabled={cutoffPassed || saving} onClick={() => { draftDirty.current = true; setSide("no"); }}>NO · Draw or away win</button></div>
          <label htmlFor="reason">Why do you think so?</label><textarea id="reason" maxLength={280} value={reason} onChange={e => { draftDirty.current = true; setReason(e.target.value); }} placeholder="Write the reason you want to remember after the match." disabled={cutoffPassed || saving}/>
          <div className="form-foot"><span>{reason.length}/280 characters</span><button className="button-primary" disabled={saving || cutoffPassed || reason.trim().length < 3 || (mode !== "simulation" && !signedIn)} onClick={() => void saveForecast()}>{saving ? "Saving…" : cutoffPassed ? "Forecast locked" : "Save forecast"}</button></div>
          {mode === "live" && !signedIn && <p className="inline-help">Connect your wallet and sign in to save your forecast.</p>}{saved && <p className="inline-feedback" role="status">{saved}</p>}
        </div>
        {forecast?.mine && <><ForecastReceipt forecast={forecast.mine} room={room} demo={mode === "simulation"} now={now}/><p className="notebook-link"><Link href="/notebook">View all your calls in My notebook</Link></p></>}
        {forecast?.reasons.length ? <div className="reasons"><h3>From the stands</h3>{forecast.reasons.map((entry, index) => <div className="reason-row" key={index}><span className={entry.side === "yes" ? "tag-yes" : "tag-no"}>{entry.side.toUpperCase()}</span><p>{entry.reason}</p><small>{entry.alias}</small></div>)}</div> : null}
      </section></div>
      <aside className={`trade-column ${tradeOpen ? "open" : ""}`}><button className="mobile-close" aria-label="Close trade panel" onClick={() => setTradeOpen(false)}><X/></button><TradePanel data={tradeData}/></aside>
    </div></div><button className="mobile-trade-cta" onClick={() => setTradeOpen(true)} disabled={Boolean(tradeData.buyUnavailableReason)}>Trade YES / NO <ArrowRight size={18}/></button>{tradeOpen && <button className="trade-backdrop" aria-label="Close trade panel" onClick={() => setTradeOpen(false)} />}</div>;
}

function TradePanel({ data }: { data: RoomData }) {
  const { room, market } = data;
  const wallet = useWallet();
  const { connection } = useConnection();
  const { session, mode } = useSoberSession();
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("5.00");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [build, setBuild] = useState<Build | null>(null);
  const [intentId, setIntentId] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [pendingSignature, setPendingSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!quote && !build) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [quote, build]);
  const eligible = mode === "live" && !data.buyUnavailableReason && Boolean(session?.wallet && wallet.publicKey && session.wallet === wallet.publicKey.toBase58());
  const settled = status?.chainStatus === "failed" || (status?.chainStatus === "confirmed" && status?.pantaStatus === "confirmed");
  const quoteExpired = Boolean(quote && now >= new Date(quote.expiresAt).getTime());
  const buildExpired = Boolean(build?.expiresAt && now >= new Date(build.expiresAt).getTime());
  function resetTrade() { if (!settled) return; sessionStorage.removeItem("sober:pending-buy"); setPendingSignature(""); setQuote(null); setBuild(null); setIntentId(""); setStatus(null); setMessage(""); setError(""); }
  function resetExpired() { if (pendingSignature) return; setQuote(null); setBuild(null); setIntentId(""); setStatus(null); setMessage("Request a fresh Panta quote before signing."); setError(""); }
  function changeSide(value: "yes" | "no") { if (pendingSignature) return; setSide(value); setQuote(null); setBuild(null); setIntentId(""); setStatus(null); }
  async function getQuote() { if (pendingSignature) return; setBusy(true); setError(""); try { const result = await post<{ intentId: string; quote: Quote }>("/api/orders/quote", { roomId: room.id, side, amountUsdc: amount, idempotencyKey: crypto.randomUUID() }); setQuote(result.quote); setIntentId(result.intentId); setMessage("Quote ready. Review the amount and fees before signing."); } catch (e) { setError(e instanceof Error ? e.message : "Quote failed"); } finally { setBusy(false); } }
  async function prepare() { if (!intentId) return; setBusy(true); setError(""); try { const result = await post<{ build: Build }>("/api/orders/build", { intentId }); setBuild(result.build); setMessage("Transaction ready. Your wallet will ask for approval only when you continue."); } catch (e) { setError(e instanceof Error ? e.message : "Build failed"); } finally { setBusy(false); } }
  async function signAndSend() {
    if (!wallet.publicKey || !wallet.signTransaction || !build || !intentId || pendingSignature) return;
    setBusy(true); setError("");
    try {
      if (build.expiresAt && Date.now() >= new Date(build.expiresAt).getTime()) throw new Error("Transaction expired. Get a new quote.");
      const tx = compileInstructions(build.instructions, wallet.publicKey, build.recentBlockhash);
      const signed = await wallet.signTransaction(tx);
      const signature = bs58.encode(signed.signatures[0]);
      const marker = { intentId, signature, marketId: room.pantaMarketId, wallet: wallet.publicKey.toBase58(), blockhash: build.recentBlockhash, lastValidBlockHeight: build.lastValidBlockHeight };
      sessionStorage.setItem("sober:pending-buy", JSON.stringify(marker));
      setPendingSignature(signature);
      await post("/api/orders/signed", { intentId, signature });
      try { await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" }); }
      catch { setMessage("Broadcast result unknown. Keep this signature and use Check status. Do not start another purchase."); return; }
      await post(`/api/orders/intent/${intentId}`, {});
      setMessage("Transaction sent. Checking chain and Panta verification.");
      await checkStatus();
    } catch (e) { setError(e instanceof Error ? e.message : "Wallet action failed"); }
    finally { setBusy(false); }
  }
  async function checkStatus() { if (!intentId) return; try { const next = await api<Status>(`/api/orders/intent/${intentId}`); setStatus(next); if (next.chainStatus === "confirmed" && next.pantaStatus === "confirmed") { setMessage("On-chain and Panta confirmation received."); sessionStorage.removeItem("sober:pending-buy"); } else if (next.chainStatus === "mismatch") { setError("The confirmed transaction does not match this order. Do not retry it. Contact support with the signature."); } } catch (e) { setError(e instanceof Error ? e.message : "Status unavailable"); } }
  useEffect(() => { try { const marker = JSON.parse(sessionStorage.getItem("sober:pending-buy") || "null"); if (marker?.marketId === room.pantaMarketId && marker?.wallet === wallet.publicKey?.toBase58()) { setIntentId(marker.intentId); setPendingSignature(marker.signature); setMessage(`Pending signature: ${marker.signature}. Check status before another trade.`); } } catch { /* ignore damaged marker */ } }, [room.pantaMarketId, wallet.publicKey]);
  const yesPrice = market?.yesPrice ?? (market?.phase === "primary" ? market.primaryYesPrice : null);
  const noPrice = market?.noPrice ?? (market?.phase === "primary" ? market.primaryNoPrice : null);
  return <div className="trade-panel"><div className="trade-head"><span className="eyebrow">PANTA MARKET</span><h2>Take a position</h2><p>Review a live quote. Your wallet asks before any purchase.</p></div><div className="market-prices"><div><span>YES</span><strong>{marketPrice(yesPrice)}</strong></div><div><span>NO</span><strong>{marketPrice(noPrice)}</strong></div></div><p className="market-time">Panta phase: {market?.phase || "Unavailable"} · Updated {new Date(data.fetchedAt).toLocaleTimeString()}</p>
    <div className="trade-form"><label>Choose a side</label><div className="side-toggle"><button className={side === "yes" ? "selected yes" : ""} disabled={Boolean(pendingSignature)} onClick={() => changeSide("yes")}>YES</button><button className={side === "no" ? "selected no" : ""} disabled={Boolean(pendingSignature)} onClick={() => changeSide("no")}>NO</button></div><label htmlFor="amount">Amount in USDC</label><div className="amount-field"><input id="amount" inputMode="decimal" value={amount} disabled={Boolean(pendingSignature)} onChange={e => { setAmount(e.target.value); setQuote(null); setBuild(null); }} /><span>USDC</span></div>
      {data.buyUnavailableReason && <div className="notice"><Info size={16}/>{data.buyUnavailableReason}</div>}{!data.buyUnavailableReason && !eligible && <div className="notice"><Info size={16}/>Connect your wallet and sign in to request a quote.</div>}
      {quote && <div className="quote-review"><div className="quote-top"><ShieldCheck size={16}/> QUOTE REVIEW</div><dl><div><dt>You pay</dt><dd>{quote.amountUsdc} USDC</dd></div><div><dt>Estimated shares</dt><dd>{quote.shares}</dd></div><div><dt>Average price</dt><dd>{quote.avgPrice}</dd></div><div><dt>Panta fee</dt><dd>{quote.feeUsdc} USDC</dd></div></dl><p>Expires {new Date(quote.expiresAt).toLocaleTimeString()}. Final outcome and payout are determined by Panta.</p></div>}
      {status && <div className="transaction-status">{status.chainStatus === "confirmed" && status.pantaStatus === "confirmed" ? <CheckCircle2 size={18}/> : <Info size={18}/>}<div><strong>{status.chainStatus === "confirmed" && status.pantaStatus === "confirmed" ? "Purchase verified" : status.chainStatus === "failed" ? "Transaction failed" : status.chainStatus === "mismatch" ? "Transaction mismatch" : "Transaction pending"}</strong><span>Chain: {status.chainStatus} · Panta: {status.pantaStatus}</span><span>Attribution: {status.attributionStatus}</span><code>{status.signature}</code></div></div>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="inline-feedback" role="status">{message}</p>}
      {!quote && <button className="button-primary full" disabled={!eligible || busy || Boolean(pendingSignature)} onClick={() => void getQuote()}>{busy ? "Working…" : "Get Panta quote"} <ArrowRight size={18}/></button>}
      {quote && !build && <button className="button-primary full" disabled={busy || !eligible || quoteExpired} onClick={() => void prepare()}>{busy ? "Preparing…" : "Continue to wallet"} <ArrowRight size={18}/></button>}
      {build && !status && <button className="button-primary full" disabled={busy || !eligible || Boolean(pendingSignature) || buildExpired} onClick={() => void signAndSend()}>{pendingSignature ? "Signature recorded" : busy ? "Working…" : "Sign and send"} <ArrowRight size={18}/></button>}
      {(quoteExpired || buildExpired) && !pendingSignature && !settled && <button className="button-secondary full" onClick={resetExpired}>Request a fresh quote</button>}
      {intentId && <button className="button-secondary full" disabled={busy} onClick={() => void checkStatus()}>Check status</button>}
      {settled && <button className="button-secondary full" onClick={resetTrade}>Start with a fresh quote</button>}
    </div><div className="trade-foot"><span>Powered by <a href="https://www.panta.market/" target="_blank" rel="noreferrer">Panta <ExternalLink size={12}/></a></span><span>Only wallet approval can submit a transaction.</span></div></div>;
}
