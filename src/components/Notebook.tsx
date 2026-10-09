"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/client-api";
import { forecastDeadline, type NotebookEntry } from "@/lib/forecast-receipt";
import { readLocalForecast } from "@/lib/local-forecast";
import type { Room } from "@/lib/rooms";
import { useVisibleRefresh } from "@/hooks/useVisibleRefresh";
import { useSoberSession } from "./WalletControl";
import { ForecastReceipt } from "./ForecastReceipt";

export function Notebook() {
  const { session, mode, refresh: refreshSession } = useSoberSession();
  const walletAddress = useWallet().publicKey?.toBase58();
  const signedIn = Boolean(session?.wallet && session.wallet === walletAddress);
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (mode === "unknown" || (mode === "live" && !signedIn)) return;
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      if (mode === "simulation") {
        const rooms = await api<Room[]>("/api/rooms", { signal: controller.signal });
        if (controller.signal.aborted) return;
        setEntries(rooms.flatMap(room => {
          const forecast = readLocalForecast(room.id);
          return forecast ? [{ roomId: room.id, homeTeam: room.homeTeam, awayTeam: room.awayTeam, competition: room.competition,
            cutoffAt: room.cutoffAt, kickoffAt: room.kickoffAt, available: true, forecast }] : [];
        }));
        setTruncated(false);
      } else {
        const result = await api<{ entries: NotebookEntry[]; truncated: boolean }>("/api/notebook", { signal: controller.signal });
        if (controller.signal.aborted) return;
        setEntries(result.entries); setTruncated(result.truncated);
      }
      setNow(Date.now());
    } catch { if (!controller.signal.aborted) setError("Your notebook could not be refreshed. Retry to check your saved calls."); }
    finally { if (request.current === controller && !controller.signal.aborted) { request.current = null; setLoading(false); setBusy(false); } }
  }, [mode, signedIn, session?.wallet]);
  useEffect(() => {
    request.current?.abort(); setEntries([]); setLoading(true); setError("");
    void load();
    return () => request.current?.abort();
  }, [load]);
  const refresh = useCallback(() => { void load(); }, [load]);
  useVisibleRefresh(refresh, mode === "simulation" || signedIn);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const shown = entries.filter(entry => {
    const locked = now >= forecastDeadline(entry.forecast, entry.cutoffAt);
    return (filter === "all" || (filter === "locked" ? locked : !locked))
      && `${entry.forecast.decision_snapshot?.homeTeam || entry.homeTeam} ${entry.forecast.decision_snapshot?.awayTeam || entry.awayTeam} ${entry.forecast.reason}`.toLowerCase().includes(query.toLowerCase());
  });
  return <div className="container utility-page"><div className="page-heading"><span className="eyebrow">SOBER / MY NOTEBOOK</span><h1>Your call. Your record.</h1><p>Keep the reason you believed before kickoff. Revisit your saved evidence and share the call you actually made.</p></div>
    {mode === "unknown" ? <div className="empty-panel" role="status"><h2>Checking your session</h2><p>Your notebook will appear once your session is available.</p><button className="button-secondary" onClick={() => void refreshSession()}>Retry session check</button></div>
      : mode === "live" && !signedIn ? <div className="empty-panel"><h2>Connect and sign in</h2><p>Use your wallet in the header to open your saved forecasts. Each wallet has its own notebook.</p><Link className="button-secondary" href="/matches">Browse match rooms</Link></div>
      : <>
        <div className="utility-toolbar"><span>{mode === "simulation" ? "Practice calls on this device" : truncated ? "Your 100 most recent calls" : `${entries.length} saved ${entries.length === 1 ? "call" : "calls"}`}</span><button className="button-secondary" disabled={busy} onClick={() => void load()}>{busy ? "Checking…" : "Refresh notebook"}</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <div className="empty-panel" role="status"><h2>Opening your notebook</h2></div> : entries.length ? <>
          <div className="catalog-filters notebook-filters"><label>Find a call<input type="search" placeholder="Team or a reason you saved" value={query} onChange={event => setQuery(event.target.value)}/></label><label>Forecast status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All calls</option><option value="open">Editable</option><option value="locked">Locked</option></select></label></div>
          <div className="notebook-list">{shown.map(entry => <ForecastReceipt key={entry.roomId} forecast={entry.forecast} room={{ id: entry.roomId, ...entry }} demo={mode === "simulation"} now={now} showRoomLink={entry.available}/>)}</div>
          {!shown.length && <div className="empty-panel"><h2>No calls match this filter</h2><p>Try another team, reason, or status.</p></div>}
        </> : !error && <div className="empty-panel"><h2>Your first call starts with a reason.</h2><p>Open a match room, read the brief and save a forecast before the cutoff. Your record will appear here.</p><Link className="button-primary" href="/matches">Make a pre-match call</Link></div>}
      </>}
  </div>;
}
