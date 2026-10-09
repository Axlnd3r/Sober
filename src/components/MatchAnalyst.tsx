"use client";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/client-api";
import type { AnalysisFeed, Evidence } from "@/lib/analysis-core";

export function MatchAnalyst({ roomId, admin = false, onAnalysis, savedSnapshotId }: { roomId: string; admin?: boolean; onAnalysis?: (id: string | null) => void; savedSnapshotId?: string | null }) {
  const [feed, setFeed] = useState<AnalysisFeed | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const load = useCallback(async (generate = false) => {
    setBusy(true); setError("");
    try {
      const path = `/api/rooms/${encodeURIComponent(roomId)}/analysis${!generate && showSaved && savedSnapshotId ? `?snapshot=${encodeURIComponent(savedSnapshotId)}` : ""}`;
      const next = generate ? await post<AnalysisFeed>(path, {}) : await api<AnalysisFeed>(path);
      setFeed(next); onAnalysis?.(next.analysis?.id ?? null);
    } catch { setError("Match analysis could not be loaded. Retry, or ask the host to check the data connection."); }
    finally { setBusy(false); }
  }, [roomId, onAnalysis, showSaved, savedSnapshotId]);
  useEffect(() => { void load(); }, [load]);
  const analysis = feed?.analysis;
  function reasons(ids: string[]) {
    const items = ids.map(id => analysis?.snapshot.evidence.find(e => e.id === id)).filter((e): e is Evidence => Boolean(e));
    return items.length ? <ul>{items.map(item => <li key={item.id}>{item.text}<div className="analyst-source">{item.sourceIds.map(id => { const source = analysis!.snapshot.sources.find(s => s.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.label} </a> : null; })}</div></li>)}</ul> : <p>No supported factor was identified in the available sample.</p>;
  }
  return <section className="analyst-panel" aria-label="Match Analyst"><h2>Match Analyst</h2>
    {savedSnapshotId && <button className="button-secondary" disabled={busy} onClick={() => setShowSaved(!showSaved)}>{showSaved ? "View latest pre-match analysis" : "View analysis saved with my forecast"}</button>}
    {showSaved && <p className="analyst-meta">Showing the snapshot attached to your forecast.</p>}
    {busy && <p role="status">{feed ? "Preparing the match brief…" : "Loading match analysis…"}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {feed && <p className="analyst-meta">{feed.message}</p>}
    {analysis && <>
      <p className="analyst-meta">{analysis.engine === "groq" ? "AI-selected evidence · Groq" : "Statistical brief · AI selection not applied"} · {new Date(analysis.generatedAt).toLocaleString()}{feed?.stale && !feed.locked ? " · Refresh needed" : ""}</p>
      {analysis.aiStatus === "unavailable" && <p>AI is temporarily unavailable. The calculated statistics are shown below.</p>}
      <table className="analysis-comparison"><caption>Available matches before this analysis. Form runs newest to oldest.</caption><thead><tr><th scope="col">Statistic</th><th scope="col">{analysis.snapshot.home.name}</th><th scope="col">{analysis.snapshot.away.name}</th></tr></thead><tbody>
        {[["Matches", "played"], ["Form", "form"], ["Wins", "wins"], ["Draws", "draws"], ["Losses", "losses"], ["Goals for", "goalsFor"], ["Goals against", "goalsAgainst"], ["Points / match", "pointsPerGame"], ["Days between kickoffs", "restDays"]].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{[analysis.snapshot.home, analysis.snapshot.away].map(team => <td key={team.teamId}>{String(team[key as keyof typeof team] ?? "Unavailable") || "Unavailable"}</td>)}</tr>)}
      </tbody></table>
      <div className="analysis-columns"><div><h3>Factors supporting YES</h3>{reasons(analysis.selection.yesEvidenceIds)}</div><div><h3>Factors supporting NO</h3>{reasons(analysis.selection.noEvidenceIds)}</div></div>
      <h3>Context to consider</h3>{reasons(analysis.selection.contextEvidenceIds)}
      <h3>Limits of this analysis</h3><ul>{analysis.snapshot.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      <details><summary>Sources and snapshot</summary><p className="analyst-meta">Version {analysis.promptVersion} · Snapshot {analysis.id}</p>{analysis.snapshot.sources.map(source => <p className="analyst-source" key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> · Retrieved {new Date(source.fetchedAt).toLocaleString()}</p>)}{analysis.snapshot.market && <p className="break-anywhere">Panta market: {analysis.snapshot.market.marketId}</p>}</details>
    </>}
    {error && <button className="button-secondary" disabled={busy} onClick={() => void load()}>Retry analysis</button>}
    {admin && feed && !feed.locked && feed.configured && <button className="button-secondary" disabled={busy} onClick={() => void load(true)}>{busy ? "Generating…" : "Generate or refresh analysis"}</button>}
  </section>;
}
