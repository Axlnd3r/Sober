export type DecisionSnapshot = {
  version: 1;
  capturedAt: string;
  homeTeam: string;
  awayTeam: string;
  question: string | null;
  kickoffAt: string;
  cutoffAt: string;
  resolutionRule: string | null;
  fixtureSourceUrl: string;
  sources: string[];
  marketStatus: "captured" | "unavailable" | "unmapped";
  market: { marketId: string; phase: string; yesPrice: string | null; noPrice: string | null } | null;
};

export type SavedForecast = {
  side: "yes" | "no";
  reason: string;
  analysis_id: string | null;
  created_at: string;
  updated_at: string;
  decision_snapshot: DecisionSnapshot | null;
};

export type NotebookEntry = {
  roomId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  cutoffAt: string;
  kickoffAt: string;
  available: boolean;
  forecast: SavedForecast;
};

type SnapshotRoom = Omit<DecisionSnapshot, "version" | "capturedAt" | "marketStatus" | "market"> & { pantaMarketId: string | null };
type SnapshotMarket = { marketId: string; phase: string; yesPrice?: string | null; noPrice?: string | null; primaryYesPrice?: string | null; primaryNoPrice?: string | null };

function quotedPrice(value?: string | null): string | null {
  if (!value || !/^\d+(\.\d+)?$/.test(value) || Number(value) > 1) return null;
  return value;
}

export function captureDecision(room: SnapshotRoom, market: SnapshotMarket | null, capturedAt = new Date().toISOString()): DecisionSnapshot {
  const matching = market && market.marketId === room.pantaMarketId ? market : null;
  return {
    version: 1, capturedAt, homeTeam: room.homeTeam, awayTeam: room.awayTeam,
    question: room.question, kickoffAt: room.kickoffAt, cutoffAt: room.cutoffAt,
    resolutionRule: room.resolutionRule, fixtureSourceUrl: room.fixtureSourceUrl, sources: [...room.sources],
    marketStatus: !room.pantaMarketId ? "unmapped" : matching ? "captured" : "unavailable",
    market: matching ? {
      marketId: matching.marketId, phase: matching.phase,
      yesPrice: quotedPrice(matching.yesPrice ?? (matching.phase === "primary" ? matching.primaryYesPrice : null)),
      noPrice: quotedPrice(matching.noPrice ?? (matching.phase === "primary" ? matching.primaryNoPrice : null)),
    } : null,
  };
}

export function forecastDeadline(forecast: SavedForecast, currentCutoff: string): number {
  const recorded = Date.parse(forecast.decision_snapshot?.cutoffAt || currentCutoff);
  return Math.min(recorded, Date.parse(currentCutoff));
}

export function forecastText(forecast: SavedForecast, room: { homeTeam: string; awayTeam: string }, roomUrl: string, demo = false): string {
  const snapshot = forecast.decision_snapshot;
  return [
    demo ? "Sober practice forecast | saved on this device" : "Sober | my pre-match call",
    `${snapshot?.homeTeam || room.homeTeam} vs ${snapshot?.awayTeam || room.awayTeam}`,
    snapshot?.question,
    `My call: ${forecast.side.toUpperCase()}`,
    `My reason: ${forecast.reason}`,
    `Last saved: ${forecast.updated_at}`,
    snapshot && `Recorded cutoff: ${snapshot.cutoffAt}`,
    snapshot?.market && `Panta at save: YES ${snapshot.market.yesPrice ?? "not quoted"}, NO ${snapshot.market.noPrice ?? "not quoted"} (USDC/share). Phase: ${snapshot.market.phase}.`,
    forecast.analysis_id && `Analysis snapshot: ${forecast.analysis_id}`,
    "A forecast records an opinion. It does not prove a trade or a result.",
    roomUrl,
  ].filter(Boolean).join("\n");
}
