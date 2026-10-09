"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { api, post } from "@/lib/client-api";
import { deserializeCreate } from "@/lib/client-solana";
import { formatUsdcBaseUnits } from "@/lib/money";
import type { Room } from "@/lib/rooms";
import { PantaMarkets } from "./PantaMarkets";
import { MatchAnalyst } from "./MatchAnalyst";
import { IntegrationStatus } from "./IntegrationStatus";

type CreateQuote = { createId: string; expectedEventPda: string; paymentUsdc: string; liquidityInjectionUsdc?: string; platformRevenueUsdc?: string; expiresAt: string };
type CreateBuild = { createId: string; expectedEventPda: string; transaction: string; expiresAt?: string };
type Draft = { competition: string; homeTeam: string; awayTeam: string; kickoffAt: string; fixtureSourceUrl: string; brief: string; question: string; resolutionRule: string; sources: string };
type Fixture = { providerId: number; competition: string; homeTeam: string; awayTeam: string; kickoffAt: string; status: string; sourceUrl: string };
type FixtureFeed = { configured: boolean; competition: string; fixtures: Fixture[]; updatedAt?: string; message?: string };
const emptyDraft: Draft = { competition: "", homeTeam: "", awayTeam: "", kickoffAt: "", fixtureSourceUrl: "", brief: "", question: "", resolutionRule: "", sources: "" };
const fixtureIssueText: Record<string, string> = {
  kickoff_not_final: "The provider has not confirmed an exact kickoff time.",
  kickoff_changed: "The provider changed the kickoff. Review the room and market rules.",
  fixture_identity_changed: "The provider changed the teams or competition. Review the room and market rules.",
};

export function AdminConsole() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [fixtureFeed, setFixtureFeed] = useState<FixtureFeed | null>(null);
  const [fixtureLoading, setFixtureLoading] = useState(false);
  const [roomEdit, setRoomEdit] = useState({ brief: "", question: "", resolutionRule: "", sources: "" });
  const [marketId, setMarketId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [marketStart, setMarketStart] = useState("");
  const [marketEnd, setMarketEnd] = useState("");
  const [resolutionTime, setResolutionTime] = useState("");
  const [quote, setQuote] = useState<CreateQuote | null>(null);
  const [build, setBuild] = useState<CreateBuild | null>(null);
  const [intentId, setIntentId] = useState("");
  const [pendingSignature, setPendingSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = rooms.find(room => room.id === selectedId);
  useEffect(() => {
    if (selected) setRoomEdit({ brief: selected.brief, question: selected.question || "", resolutionRule: selected.resolutionRule || "", sources: selected.sources.join("\n") });
  }, [selectedId, rooms]);

  const load = useCallback(async () => {
    try {
      const result = await api<Room[]>("/api/admin/rooms");
      setRooms(result);
      setSelectedId(current => current || result[0]?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load rooms"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    api<FixtureFeed>("/api/admin/fixtures").then(result => { if (active) setFixtureFeed(result); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load fixture provider"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    try {
      const marker = JSON.parse(sessionStorage.getItem("sober:pending-create") || "null");
      if (marker?.wallet === wallet.publicKey?.toBase58()) {
        setSelectedId(marker.roomId);
        setIntentId(marker.intentId);
        setPendingSignature(marker.signature);
        setMessage(`Create signature ${marker.signature} is pending registration. Check it before another create.`);
      }
    } catch { /* damaged local recovery marker */ }
  }, [wallet.publicKey]);

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await post<{ id: string }>("/api/admin/rooms", {
        ...draft,
        kickoffAt: new Date(draft.kickoffAt).toISOString(),
        sources: draft.sources.split(/\r?\n/).map(source => source.trim()).filter(Boolean),
      });
      await load();
      setSelectedId(result.id);
      setDraft(emptyDraft);
      setMessage("Draft room created. Review the question, resolution rule, sources, and cutoff before publishing.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create room"); }
    finally { setBusy(false); }
  }

  async function refreshFixtures() {
    setFixtureLoading(true); setError("");
    try { setFixtureFeed(await api<FixtureFeed>("/api/admin/fixtures")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load fixtures"); }
    finally { setFixtureLoading(false); }
  }

  async function importProviderFixture(providerId: number) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await post<{ id: string }>("/api/admin/fixtures", { providerId });
      await load(); setSelectedId(result.id);
      setMessage("Fixture imported as an unpublished draft. Review its question, resolution rule, and public sources before mapping or creating a market.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not import fixture"); }
    finally { setBusy(false); }
  }

  async function saveRoomEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/api/admin/rooms/${encodeURIComponent(selected.id)}`, { method: "PATCH", body: JSON.stringify({ action: "edit", ...roomEdit, sources: roomEdit.sources.split(/\r?\n/).map(value => value.trim()).filter(Boolean) }) });
      await load(); setMessage("Draft details saved. Review them again before mapping the market.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save draft details"); }
    finally { setBusy(false); }
  }

  async function updateRoom(action: { action: "map"; marketId: string } | { action: "publish" } | { action: "pause"; paused: boolean }) {
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/api/admin/rooms/${encodeURIComponent(selected.id)}`, { method: "PATCH", body: JSON.stringify(action) });
      await load();
      setMessage(action.action === "map" ? "Market question and cutoff verified. Room is still unpublished." : action.action === "publish" ? "Room published." : action.paused ? "Trading paused for this room." : "Trading resumed for this room.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update room"); }
    finally { setBusy(false); }
  }

  async function quoteMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pendingSignature) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await post<{ intentId: string; quote: CreateQuote }>("/api/admin/create/quote", {
        roomId: selected.id,
        startTime: Math.floor(new Date(marketStart).getTime() / 1000),
        endTime: Math.floor(new Date(marketEnd).getTime() / 1000),
        resolutionTime: Math.floor(new Date(resolutionTime).getTime() / 1000),
        imageUrl,
        idempotencyKey: crypto.randomUUID(),
      });
      setQuote(result.quote); setBuild(null); setIntentId(result.intentId);
      setMessage("Creation fee returned by Panta. Review it before requesting a transaction.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not quote market creation"); }
    finally { setBusy(false); }
  }

  async function buildMarket() {
    if (!intentId || pendingSignature) return;
    setBusy(true); setError("");
    try {
      const result = await post<{ build: CreateBuild }>("/api/admin/create/build", { intentId });
      setBuild(result.build);
      setMessage("Unsigned create transaction ready. Wallet approval is still required.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not build market creation"); }
    finally { setBusy(false); }
  }

  async function signAndSend() {
    if (!wallet.publicKey || !wallet.signTransaction || !build || !intentId || !selected || pendingSignature) return;
    setBusy(true); setError("");
    try {
      if (build.expiresAt && Date.now() >= new Date(build.expiresAt).getTime()) throw new Error("Create build expired. Request a new quote.");
      const transaction = deserializeCreate(build.transaction);
      if (!transaction.message.staticAccountKeys[0]?.equals(wallet.publicKey)) throw new Error("Create transaction fee payer differs from the connected wallet");
      const signed = await wallet.signTransaction(transaction);
      const signature = bs58.encode(signed.signatures[0]);
      sessionStorage.setItem("sober:pending-create", JSON.stringify({ roomId: selected.id, intentId, signature, wallet: wallet.publicKey.toBase58() }));
      setPendingSignature(signature);
      await post("/api/admin/create/signed", { intentId, signature });
      try {
        await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
        setMessage("Create transaction sent. Register only after chain confirmation.");
      } catch {
        setMessage("Broadcast result unknown. Keep this signature and check registration before doing anything else.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign market creation"); }
    finally { setBusy(false); }
  }

  async function registerMarket() {
    if (!intentId || !pendingSignature) return;
    setBusy(true); setError("");
    try {
      const result = await post<{ marketId: string }>("/api/admin/create/register", { intentId });
      sessionStorage.removeItem("sober:pending-create");
      setPendingSignature(""); setQuote(null); setBuild(null); setIntentId("");
      await load();
      setMessage(`Panta registered market ${result.marketId}. Review the mapping before publication.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Registration is pending or failed"); }
    finally { setBusy(false); }
  }

  const fee = quote ? formatUsdcBaseUnits(BigInt(quote.paymentUsdc)) : null;
  return <div className="container utility-page admin-page">
    <div className="page-heading"><span className="eyebrow">HOST / PANTA</span><h1>Match administration</h1><p>Draft rooms, review a Panta mapping, and publish only after the question and cutoff match. Creating a market spends USDC only after wallet approval.</p><Link className="text-link" href="/admin/evidence">View operational evidence</Link></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <IntegrationStatus/>
    <PantaMarkets onSelect={market => { setMarketId(market.marketId); setMessage(`Selected: ${market.title}. Review the teams, date, exact question and resolution rules against the room before mapping.`); }}/>
    {selected && <MatchAnalyst key={selected.id} roomId={selected.id} admin/>}
    {message && <p className="inline-feedback" role="status">{message}</p>}
    <section className="content-panel admin-section"><h2>Import real fixtures</h2><p className="muted">Football-data.org fixtures enter as unpublished drafts. Schedule, market question, and resolution sources need host review. No market or transaction is created by importing.</p>
      {!fixtureFeed ? <p role="status">Checking football data configuration…</p> : !fixtureFeed.configured ? <p role="status">{fixtureFeed.message}</p> : <><p>Competition: {fixtureFeed.competition} · Next 21 days · {fixtureFeed.fixtures.length} provider fixtures. SCHEDULED means the kickoff time is still provisional; market actions require TIMED.</p><button type="button" className="button-secondary" disabled={fixtureLoading || busy} onClick={() => void refreshFixtures()}>{fixtureLoading ? "Refreshing…" : "Refresh fixtures"}</button><div className="admin-fixture-list">{fixtureFeed.fixtures.length === 0 ? <p>No fixtures returned for this period.</p> : fixtureFeed.fixtures.map(fixture => <div className="admin-fixture-row" key={fixture.providerId}><div><strong>{fixture.homeTeam} vs {fixture.awayTeam}</strong><p>{new Date(fixture.kickoffAt).toLocaleString()} · {fixture.status} · Provider ID {fixture.providerId}</p></div><button type="button" className="button-secondary" disabled={busy || !["SCHEDULED", "TIMED"].includes(fixture.status) || new Date(fixture.kickoffAt).getTime() <= Date.now() + 10 * 60_000} onClick={() => void importProviderFixture(fixture.providerId)}>Import draft</button></div>)}</div>{fixtureFeed.updatedAt && <p className="muted">Checked {new Date(fixtureFeed.updatedAt).toLocaleString()}</p>}</>}
    </section>
    <section className="content-panel admin-section"><h2>Existing rooms</h2><label htmlFor="admin-room">Select room</label><select id="admin-room" value={selectedId} onChange={event => { setSelectedId(event.target.value); setQuote(null); setBuild(null); setIntentId(""); setMarketId(""); }} disabled={Boolean(pendingSignature)}><option value="">Choose a room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.homeTeam} vs {room.awayTeam} · {room.published ? "Published" : "Draft"}</option>)}</select>
      {selected?.fixtureIssue && <p className="form-error" role="alert">Trading paused: {fixtureIssueText[selected.fixtureIssue] || "The provider fixture needs host review."}</p>}
      {selected && <div className="admin-room-details"><p><strong>{selected.question || "Question missing"}</strong></p><p>Cutoff: {new Date(selected.cutoffAt).toLocaleString()} · Mapped market: {selected.pantaMarketId || "none"}</p><p>Review: {selected.reviewed ? "complete" : "required"} · Trading: {selected.tradingPaused ? "paused" : "allowed by room"}</p>{selected.providerFixtureId && <p>Football-data.org fixture {selected.providerFixtureId} · {selected.providerStatus} · synced {selected.fixtureSyncedAt ? new Date(selected.fixtureSyncedAt).toLocaleString() : "unknown"}</p>}<details><summary>Resolution and sources</summary><p>{selected.resolutionRule || "Missing resolution rule"}</p>{selected.sources.map(source => <p key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></p>)}</details></div>}
      {selected && !selected.pantaMarketId && !selected.reviewed && !selected.published && <form className="admin-form" onSubmit={event => void saveRoomEdit(event)}><h3>Review draft details</h3><label>Match brief<textarea maxLength={1200} value={roomEdit.brief} onChange={event => setRoomEdit({ ...roomEdit, brief: event.target.value })}/></label><label>Exact market question<input required minLength={20} maxLength={512} value={roomEdit.question} onChange={event => setRoomEdit({ ...roomEdit, question: event.target.value })}/></label><label>Resolution rule<textarea required minLength={40} maxLength={2048} value={roomEdit.resolutionRule} onChange={event => setRoomEdit({ ...roomEdit, resolutionRule: event.target.value })}/></label><label>Public resolution source URLs, one per line<textarea required value={roomEdit.sources} onChange={event => setRoomEdit({ ...roomEdit, sources: event.target.value })}/></label><button type="submit" className="button-secondary" disabled={busy}>Save reviewed draft details</button></form>}
      {selected && <div className="admin-actions"><div><label htmlFor="admin-market-id">Existing Panta market ID</label><input id="admin-market-id" value={marketId} onChange={event => setMarketId(event.target.value)} placeholder="Verified Panta market ID"/><button className="button-secondary" disabled={busy || marketId.length < 20} onClick={() => void updateRoom({ action: "map", marketId })}>Verify and map</button></div><button className="button-primary" disabled={busy || !selected.reviewed || !selected.pantaMarketId || selected.published} onClick={() => void updateRoom({ action: "publish" })}>Publish reviewed room</button><button className="button-secondary" disabled={busy} onClick={() => void updateRoom({ action: "pause", paused: !selected.tradingPaused })}>{selected.tradingPaused ? "Resume trading" : "Pause trading"}</button></div>}
      {pendingSignature && <div className="admin-quote"><p>Pending creation signature: <code>{pendingSignature}</code></p><button className="button-secondary" disabled={busy} onClick={() => void registerMarket()}>Check chain and register with Panta</button></div>}
    </section>
    <section className="content-panel admin-section"><h2>Create a room draft</h2><form className="admin-form" onSubmit={event => void createRoom(event)}><div className="admin-pair"><label>Competition<input required minLength={2} maxLength={100} value={draft.competition} onChange={event => setDraft({ ...draft, competition: event.target.value })}/></label><label>Kickoff, your local time<input required type="datetime-local" value={draft.kickoffAt} onChange={event => setDraft({ ...draft, kickoffAt: event.target.value })}/></label></div><div className="admin-pair"><label>Home team<input required minLength={2} maxLength={100} value={draft.homeTeam} onChange={event => setDraft({ ...draft, homeTeam: event.target.value })}/></label><label>Away team<input required minLength={2} maxLength={100} value={draft.awayTeam} onChange={event => setDraft({ ...draft, awayTeam: event.target.value })}/></label></div><label>Fixture source URL<input required type="url" value={draft.fixtureSourceUrl} onChange={event => setDraft({ ...draft, fixtureSourceUrl: event.target.value })}/></label><label>Match brief<textarea maxLength={1200} value={draft.brief} onChange={event => setDraft({ ...draft, brief: event.target.value })}/></label><label>Exact Panta question<input required minLength={20} maxLength={512} value={draft.question} onChange={event => setDraft({ ...draft, question: event.target.value })}/></label><label>Resolution rule<textarea required minLength={40} maxLength={2048} value={draft.resolutionRule} onChange={event => setDraft({ ...draft, resolutionRule: event.target.value })}/></label><label>Resolution source URLs, one per line<textarea required value={draft.sources} onChange={event => setDraft({ ...draft, sources: event.target.value })}/></label><button className="button-primary" disabled={busy} type="submit">Save draft room</button></form></section>
    {selected && !selected.pantaMarketId && <section className="content-panel admin-section"><h2>Create a Panta market</h2><p className="muted">Panta returns the fee. Signing and broadcasting require an explicit wallet approval. Times below are in your browser&apos;s local timezone.</p><form className="admin-form" onSubmit={event => void quoteMarket(event)}><label>Permanent public image URL<input required type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)}/></label><div className="admin-pair"><label>Market opens<input required type="datetime-local" value={marketStart} onChange={event => setMarketStart(event.target.value)}/></label><label>Market closes<input required type="datetime-local" value={marketEnd} onChange={event => setMarketEnd(event.target.value)}/></label></div><label>Resolution time<input required type="datetime-local" value={resolutionTime} onChange={event => setResolutionTime(event.target.value)}/></label><button className="button-secondary" disabled={busy || Boolean(pendingSignature)} type="submit">Request creation fee</button></form>
      {quote && <div className="admin-quote"><h3>Fee review</h3><p>Wallet debit quoted by Panta: <strong>{fee} USDC</strong></p><p>Expected event: {quote.expectedEventPda}</p><p>Quote expires: {new Date(quote.expiresAt).toLocaleString()}</p><button className="button-primary" disabled={busy || Boolean(build) || Boolean(pendingSignature) || Date.now() >= new Date(quote.expiresAt).getTime()} onClick={() => void buildMarket()}>Build transaction</button></div>}
      {build && <div className="admin-quote"><p>The market creation transaction is unsigned. The wallet will display its own approval request.</p><button className="button-primary" disabled={busy || Boolean(pendingSignature)} onClick={() => void signAndSend()}>{pendingSignature ? "Signature recorded" : "Sign and send creation"}</button></div>}
    </section>}
  </div>;
}
