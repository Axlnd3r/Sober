import { z } from "zod";

export const historicalMatchSchema = z.object({
  id: z.number().int().positive(), utcDate: z.string().datetime(), status: z.literal("FINISHED"),
  homeTeam: z.object({ id: z.number().int().positive(), name: z.string() }),
  awayTeam: z.object({ id: z.number().int().positive(), name: z.string() }),
  score: z.object({ duration: z.literal("REGULAR"), fullTime: z.object({ home: z.number().int().nonnegative(), away: z.number().int().nonnegative() }) }),
});
export type HistoricalMatch = z.infer<typeof historicalMatchSchema>;
export type TeamStats = { teamId: number; name: string; played: number; wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; form: string; pointsPerGame: number | null;
  venuePlayed: number; venueWins: number; restDays: number | null; matchIds: number[] };
export type Evidence = { id: string; side: "yes" | "no" | "context"; text: string; sourceIds: string[] };
export type AnalysisSnapshot = { asOf: string; fixture: { home: string; away: string; kickoffAt: string; cutoffAt: string; question: string | null; marketId: string | null };
  home: TeamStats; away: TeamStats; evidence: Evidence[]; limitations: string[];
  sources: { id: string; label: string; url: string; fetchedAt: string }[];
  market: { marketId: string; title: string; phase: string; yesPrice: string | null; noPrice: string | null; fetchedAt: string } | null;
  history: HistoricalMatch[] };
export const analysisSelectionSchema = z.object({
  yesEvidenceIds: z.array(z.string()).max(4), noEvidenceIds: z.array(z.string()).max(4), contextEvidenceIds: z.array(z.string()).min(1).max(4),
}).strict();
export type AnalysisSelection = z.infer<typeof analysisSelectionSchema>;
export type AnalysisResult = { id: string; snapshot: AnalysisSnapshot; selection: AnalysisSelection; engine: "groq" | "statistics";
  model: string | null; aiStatus: "ready" | "unconfigured" | "unavailable" | "insufficient_data"; generatedAt: string; expiresAt: string;
  promptVersion: string };
export type AnalysisFeed = { analysis: AnalysisResult | null; message: string; stale: boolean; locked: boolean; configured: boolean };

export function cleanHistory(rows: unknown[], teamId: number, asOf: string): HistoricalMatch[] {
  const before = new Date(asOf).getTime();
  const records = rows.flatMap(row => { const value = historicalMatchSchema.safeParse(row); return value.success ? [value.data] : []; });
  return [...new Map(records.filter(m => (m.homeTeam.id === teamId || m.awayTeam.id === teamId) &&
    new Date(m.utcDate).getTime() < before && new Date(m.utcDate).getTime() >= before - 366 * 86400_000).map(m => [m.id, m])).values()]
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate)).slice(0, 10);
}
export function teamStats(teamId: number, name: string, rows: HistoricalMatch[], venue: "home" | "away", kickoffAt: string): TeamStats {
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, venuePlayed = 0, venueWins = 0;
  const form: string[] = [];
  for (const match of rows) {
    const home = match.homeTeam.id === teamId;
    const scored = home ? match.score.fullTime.home : match.score.fullTime.away;
    const conceded = home ? match.score.fullTime.away : match.score.fullTime.home;
    goalsFor += scored; goalsAgainst += conceded;
    if (scored > conceded) { wins++; form.push("W"); } else if (scored === conceded) { draws++; form.push("D"); } else { losses++; form.push("L"); }
    if (home === (venue === "home")) { venuePlayed++; if (scored > conceded) venueWins++; }
  }
  return { teamId, name, played: rows.length, wins, draws, losses, goalsFor, goalsAgainst, form: form.slice(0, 5).join(" "),
    pointsPerGame: rows.length ? Math.round((wins * 3 + draws) / rows.length * 100) / 100 : null,
    venuePlayed, venueWins, restDays: rows.length ? Math.max(0, Math.floor((Date.parse(kickoffAt) - Date.parse(rows[0].utcDate)) / 86400_000)) : null,
    matchIds: rows.map(m => m.id) };
}
export function buildEvidence(home: TeamStats, away: TeamStats, h2h: HistoricalMatch[]): Evidence[] {
  const evidence: Evidence[] = [
    { id: "outcome", side: "context", text: "YES means a home win after 90 minutes plus stoppage time. NO includes a draw or an away win. Extra time and penalties are excluded.", sourceIds: ["fixture"] },
    { id: "home-form", side: "context", text: `${home.name}: ${home.wins} wins, ${home.draws} draws and ${home.losses} losses in ${home.played} available completed matches.`, sourceIds: ["home-history"] },
    { id: "away-form", side: "context", text: `${away.name}: ${away.wins} wins, ${away.draws} draws and ${away.losses} losses in ${away.played} available completed matches.`, sourceIds: ["away-history"] },
  ];
  if (home.played >= 5 && away.played >= 5) {
    if (home.pointsPerGame! > away.pointsPerGame!) evidence.push({ id: "form-advantage", side: "yes", text: `${home.name} earned ${home.pointsPerGame} points per match in this sample, compared with ${away.pointsPerGame} for ${away.name}. Opponent strength is not adjusted.`, sourceIds: ["home-history", "away-history"] });
    if (away.pointsPerGame! > home.pointsPerGame!) evidence.push({ id: "form-advantage", side: "no", text: `${away.name} earned ${away.pointsPerGame} points per match in this sample, compared with ${home.pointsPerGame} for ${home.name}. Opponent strength is not adjusted.`, sourceIds: ["home-history", "away-history"] });
    if (home.draws) evidence.push({ id: "draw-risk", side: "no", text: `${home.name} drew ${home.draws} of ${home.played} matches in this sample. A draw would resolve the room's home-win question to NO.`, sourceIds: ["home-history", "fixture"] });
    if (home.venuePlayed >= 3 && home.venueWins > home.venuePlayed / 2) evidence.push({ id: "home-venue", side: "yes", text: `${home.name} won ${home.venueWins} of ${home.venuePlayed} home matches within this sample.`, sourceIds: ["home-history"] });
    if (away.venuePlayed >= 3 && away.venueWins > away.venuePlayed / 2) evidence.push({ id: "away-venue", side: "no", text: `${away.name} won ${away.venueWins} of ${away.venuePlayed} away matches within this sample.`, sourceIds: ["away-history"] });
  }
  evidence.push({ id: "h2h", side: "context", text: `${h2h.length} direct meeting${h2h.length === 1 ? " was" : "s were"} found within the retrieved histories. This is not a complete head-to-head archive.`, sourceIds: ["home-history", "away-history"] });
  return evidence;
}
export function defaultSelection(evidence: Evidence[]): AnalysisSelection {
  return { yesEvidenceIds: evidence.filter(e => e.side === "yes").slice(0, 4).map(e => e.id), noEvidenceIds: evidence.filter(e => e.side === "no").slice(0, 4).map(e => e.id), contextEvidenceIds: evidence.filter(e => e.side === "context").slice(0, 4).map(e => e.id) };
}
export function validateSelection(value: unknown, evidence: Evidence[]) {
  const result = analysisSelectionSchema.parse(value);
  for (const [field, side] of [["yesEvidenceIds", "yes"], ["noEvidenceIds", "no"], ["contextEvidenceIds", "context"]] as const) {
    if (new Set(result[field]).size !== result[field].length || result[field].some(id => !evidence.some(e => e.id === id && e.side === side))) throw new Error("Analyst returned unsupported evidence");
  }
  return result;
}
