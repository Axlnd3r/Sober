import type { CatalogFeed } from "@/lib/market-display";
import type { DiscoveredMatch, TeamAsset } from "@/lib/football-market-core";

export type CinemaFixture = {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffAt: string | null;
  sourceUrl: string;
  roomId?: string;
  marketId?: string;
  marketQuestion?: string;
  homeAsset?: TeamAsset;
  awayAsset?: TeamAsset;
  matchDate?: string | null;
  marketEndsAt?: string | null;
  sourceKind?: "panta" | "schedule" | "room";
};
export type CinemaRoom = { id: string; pantaMarketId: string | null; homeTeam: string; awayTeam: string };
export type DrawerTab = "markets" | "analyst" | "fixture" | "story";
export type MarketSelection = { marketId: string; side: "YES" | "NO" };
export type HeroSlide = {
  id: string;
  chapter: string;
  image: string;
  imageAlt: string;
  heading: string[];
  subtitle: string;
  category: string;
  story: { heading: string; paragraphs: string[] };
  foregroundClip: string;
};
export type CinemaProps = { initialFeed: CatalogFeed; fixture: CinemaFixture | null; rooms: CinemaRoom[]; initialMatches?: DiscoveredMatch[] };

export function makeSlides(fixture: CinemaFixture | null): HeroSlide[] {
  const home = fixture?.homeTeam || "the home side";
  const color = fixture?.homeAsset?.color || "#b31b27";
  const rgb = [1, 3, 5].map(position => parseInt(color.slice(position, position + 2), 16));
  const matchImage = Math.min(...rgb) > 185 ? "/images/cinema/market.webp" : rgb[2] > rgb[0] * 1.2 ? "/images/cinema/form.webp" : "/images/cinema/matchday.webp";
  return [
    {
      id: "matchday", chapter: "The fixture", image: matchImage,
      imageAlt: "Fictional footballers in red and a referee in a floodlit stadium",
      heading: fixture?.marketId ? [fixture.homeTeam, `vs ${fixture.awayTeam}`] : [`Can ${home}`, "make home", "advantage count?"],
      subtitle: fixture?.marketId ? "The match. Your perspective." : fixture ? `${fixture.homeTeam} vs ${fixture.awayTeam}` : "The next match starts here",
      category: fixture?.competition || "Football · Matchday",
      story: { heading: "What to watch before kickoff", paragraphs: [
        `${fixture?.marketQuestion ? `Panta asks: ${fixture.marketQuestion}` : fixture ? `${fixture.homeTeam} and ${fixture.awayTeam} are on the upcoming schedule.` : "Start with a fixture from the match centre."} Check the exact question before comparing the two sides.`,
        "Compare recent results in the same competition, goals scored and conceded, and home versus away performance. A short winning run may come against very different opponents.",
        "Read the market's resolution rules before making a call. A home-win YES position and a NO position cover different outcomes: NO can include both a draw and an away win.",
        "In a Sober match room, record your pick and reason before the forecast cutoff. Fan views remain separate from the Panta market price.",
      ] },
      foregroundClip: "polygon(5% 100%,9% 85%,12% 70%,15% 51%,21% 41%,24% 36%,24% 28%,23% 23%,23% 17%,25% 12%,30% 9%,34% 11%,37% 16%,38% 25%,37% 33%,36% 37%,40% 41%,46% 44%,49% 56%,51% 70%,50% 85%,48% 100%)",
    },
    {
      id: "form", chapter: "The analysis", image: "/images/cinema/form.webp",
      imageAlt: "Two fictional footballers in blue against blurred stadium lights",
      heading: ["Good form.", "But what does", "the history say?"],
      subtitle: "Look beyond the last result",
      category: "Match Analyst · Form & history",
      story: { heading: "A result needs context", paragraphs: [
        "Five recent results can tell very different stories. The venue, quality of opposition and gaps between matches all change how useful that sequence is.",
        "Sober's Match Analyst calculates form, goals, points per match and rest from completed fixtures. When configured, the AI agent selects supporting evidence from those calculations and links it to its source.",
        "A brief can contain evidence for both outcomes. If the available history is too thin, the analyst says so. It does not invent a win probability or fill gaps with a confident forecast.",
      ] },
      foregroundClip: "polygon(6% 100%,9% 80%,13% 57%,17% 44%,25% 37%,24% 29%,22% 21%,24% 13%,30% 8%,36% 10%,40% 17%,40% 25%,37% 34%,38% 37%,44% 41%,48% 52%,51% 64%,52% 78%,49% 100%)",
    },
    {
      id: "market", chapter: "The market", image: "/images/cinema/market.webp",
      imageAlt: "Fictional footballers in off-white shirts before a night match",
      heading: ["What does the", "market see", "before kickoff?"],
      subtitle: "A different view of the same game",
      category: "Panta · Market perspective",
      story: { heading: "Price is a starting point", paragraphs: [
        "Prediction markets put a price on possible outcomes. When Panta supplies current YES and NO prices, Sober shows them in USDC per share.",
        "The displayed price is a market snapshot. It can change before an order is placed, and it is not a forecast produced by Sober's AI analyst.",
        "Use the market view alongside the match brief. Trading requires a reviewed match room, an eligible market and a wallet confirmation. Browsing or selecting a side here does not place an order.",
      ] },
      foregroundClip: "polygon(7% 100%,9% 86%,3% 70%,2% 62%,8% 50%,17% 40%,26% 36%,25% 28%,24% 22%,23% 15%,28% 8%,34% 8%,39% 14%,41% 23%,39% 30%,36% 36%,40% 40%,46% 43%,50% 55%,52% 64%,50% 77%,46% 88%,45% 100%)",
    },
  ];
}

export function priceCents(value?: string | null) {
  if (value == null || !/^\d+(\.\d+)?$/.test(value)) return "—";
  return `${(Number(value) * 100).toFixed(1)}¢`;
}
export function initials(team: string) { return team.replace(/\b(FC|United|City)\b/gi, "").trim().slice(0, 3).toUpperCase(); }
