import type { SavedForecast } from "./forecast-receipt";

export function readLocalForecast(roomId: string): SavedForecast | null {
  try {
    const stored = JSON.parse(localStorage.getItem(`sober:demo-forecast:${roomId}`) || "null");
    if (!stored || !["yes", "no"].includes(stored.side) || typeof stored.reason !== "string") return null;
    const created = stored.created_at || stored.savedAt;
    const updated = stored.updated_at || stored.savedAt;
    if (!Number.isFinite(Date.parse(created)) || !Number.isFinite(Date.parse(updated))) return null;
    // Legacy practice saves did not retain fixture or market context.
    const snapshot = stored.decision_snapshot;
    const validSnapshot = snapshot?.version === 1 && typeof snapshot.homeTeam === "string" && typeof snapshot.awayTeam === "string"
      && typeof snapshot.fixtureSourceUrl === "string" && Array.isArray(snapshot.sources) && snapshot.sources.every((s: unknown) => typeof s === "string")
      && Number.isFinite(Date.parse(snapshot.cutoffAt)) && Number.isFinite(Date.parse(snapshot.capturedAt)) && snapshot.market === null;
    return { side: stored.side, reason: stored.reason, analysis_id: null, created_at: created, updated_at: updated,
      decision_snapshot: validSnapshot ? snapshot : null };
  } catch { return null; }
}
