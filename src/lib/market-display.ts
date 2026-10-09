export type CatalogMarket = {
  marketId: string; title: string; category: string; phase: string;
  description?: string; yesPrice?: string | null; noPrice?: string | null;
  startTime?: number | null; endTime?: number | null; resolutionTime?: number | null;
  priceSource?: string; valuationStatus?: string;
  resolved?: boolean; status?: string; images?: string[];
};
export type CatalogFeed = {
  status: "connected" | "unconfigured" | "unavailable" | "demo";
  markets: CatalogMarket[]; checkedAt: string; message: string;
  nextCursor: string | null; scanned: number;
};
export function marketWindow(market: CatalogMarket, now = Date.now()) {
  if (market.resolved || market.phase === "resolved") return "Resolved";
  if (market.endTime && now >= market.endTime * 1000) return "Trading ended";
  if (market.startTime && now < market.startTime * 1000) return "Opening soon";
  return market.phase === "primary" ? "Primary market" : market.phase === "secondary" ? "Secondary market" : market.phase;
}
export function marketPrice(value?: string | null) {
  if (value == null || !/^\d+(\.\d+)?$/.test(value)) return "Not quoted";
  return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC`;
}
