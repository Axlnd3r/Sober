"use client";
import Link from "next/link";
import { useState } from "react";
import { forecastDeadline, forecastText, type SavedForecast } from "@/lib/forecast-receipt";
import { marketPrice } from "@/lib/market-display";

export function ForecastReceipt({ forecast, room, demo = false, now = Date.now(), showRoomLink = false }: {
  forecast: SavedForecast;
  room: { id: string; homeTeam: string; awayTeam: string; cutoffAt: string };
  demo?: boolean;
  now?: number;
  showRoomLink?: boolean;
}) {
  const [message, setMessage] = useState("");
  const snapshot = forecast.decision_snapshot;
  const locked = now >= forecastDeadline(forecast, room.cutoffAt);
  const roomPath = `/matches/${encodeURIComponent(room.id)}`;
  const record = { format: "sober-forecast-v1", storage: demo ? "browser-practice" : "sober", roomId: room.id,
    ...forecast, notice: "An exported opinion record. Not a signed transaction or proof of a result." };
  const downloadUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(record, null, 2))}`;
  const downloadName = `sober-call-${room.id.replace(/[^a-zA-Z0-9_-]/g, "-")}.json`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(forecastText(forecast, room, new URL(roomPath, location.origin).href, demo));
      setMessage("Forecast copied. It includes your reason and saved time.");
    } catch { setMessage("Clipboard is unavailable. Download your record instead."); }
  }
  return <section className="forecast-receipt" aria-label="Saved forecast record">
    <div className="receipt-top"><span className="eyebrow">{demo ? "PRACTICE / THIS DEVICE" : "SOBER / YOUR RECORD"}</span><span className="receipt-state">{locked ? "Locked" : "Editable until cutoff"}</span></div>
    <h3>{snapshot?.homeTeam || room.homeTeam} <span>vs</span> {snapshot?.awayTeam || room.awayTeam}</h3>
    {snapshot?.question && <p className="receipt-question">{snapshot.question}</p>}
    <div className="receipt-call"><strong className={forecast.side === "yes" ? "tag-yes" : "tag-no"}>{forecast.side.toUpperCase()}</strong><blockquote>{forecast.reason}</blockquote></div>
    <dl className="receipt-dates"><div><dt>Last saved</dt><dd><time dateTime={forecast.updated_at}>{new Date(forecast.updated_at).toLocaleString()}</time></dd></div><div><dt>{locked ? "Locked at" : "Locks at"}</dt><dd>{new Date(forecastDeadline(forecast, room.cutoffAt)).toLocaleString()}</dd></div></dl>
    <details className="receipt-evidence"><summary>What was available when you saved</summary>
      {snapshot ? <>
        <p>Context captured {new Date(snapshot.capturedAt).toLocaleString()}.</p>
        {snapshot.market ? <><dl className="receipt-dates"><div><dt>Panta YES at save</dt><dd>{marketPrice(snapshot.market.yesPrice)}</dd></div><div><dt>Panta NO at save</dt><dd>{marketPrice(snapshot.market.noPrice)}</dd></div></dl><p>Prices per share. Phase at save: {snapshot.market.phase}. These are historical quotes.</p></> : <p>{snapshot.marketStatus === "unmapped" ? "No Panta market was mapped at save time." : "Panta could not be checked at save time. No price was recorded."}</p>}
        {snapshot.resolutionRule && <p>{snapshot.resolutionRule}</p>}
        {snapshot.fixtureSourceUrl.startsWith("https://") && <p><a href={snapshot.fixtureSourceUrl} target="_blank" rel="noreferrer">Recorded fixture source</a></p>}
        {snapshot.sources.filter(source => source.startsWith("https://")).map((source, i) => <p key={source}><a href={source} target="_blank" rel="noreferrer">Recorded resolution source {i + 1}</a></p>)}
      </> : <p>This older forecast has no recorded market or fixture snapshot.</p>}
      <p>{forecast.analysis_id ? <>Analysis snapshot: <code>{forecast.analysis_id}</code>. Open the match room to revisit it.</> : "No analyst snapshot was attached."}</p>
      <p>First saved {new Date(forecast.created_at).toLocaleString()}. A forecast records an opinion; it does not prove a trade or a result.</p>
    </details>
    <div className="receipt-actions"><button className="button-secondary" onClick={() => void copy()}>Copy forecast</button><a className="button-secondary" href={downloadUrl} download={downloadName}>Download record</a>{showRoomLink && <Link className="button-secondary" href={roomPath}>Open match room</Link>}</div>
    {message && <p className="inline-feedback" role="status">{message}</p>}
  </section>;
}
