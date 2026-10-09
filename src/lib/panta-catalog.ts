import "server-only";
import { mode } from "./config";
import { marketListSchema, marketSchema, panta, PantaError } from "./panta";
import type { CatalogFeed, CatalogMarket } from "./market-display";

const cache = new Map<string, { until: number; result: Promise<CatalogFeed> }>();
export function getPantaCatalog(cursor = ""): Promise<CatalogFeed> {
  const existing = cache.get(cursor);
  if (existing && existing.until > Date.now()) return existing.result;
  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  const result = readCatalog(cursor);
  cache.set(cursor, { until: Date.now() + 60_000, result });
  return result;
}
async function readCatalog(cursor: string): Promise<CatalogFeed> {
  const empty = { markets: [], checkedAt: new Date().toISOString(), nextCursor: null, scanned: 0 };
  if (mode === "simulation") return { ...empty, status: "demo", message: "Simulation mode. Live Panta requests are disabled." };
  if (!process.env.PANTA_API_KEY) return { ...empty, status: "unconfigured", message: "Panta market discovery is not configured yet." };
  try {
    const listing = await panta(`/markets/?category=sports&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, marketListSchema);
    const markets: CatalogMarket[] = listing.items.filter(item => item.category.toLowerCase() === "sports" && item.title.trim().length > 0).map(item => ({
      marketId: item.marketId, title: item.title.trim(), category: item.category, phase: item.phase,
      yesPrice: item.yesPrice, noPrice: item.noPrice, startTime: item.startTime, endTime: item.endTime, resolutionTime: item.resolutionTime,
      description: typeof item.description === "string" ? item.description : "",
      priceSource: typeof item.priceSource === "string" ? item.priceSource : undefined,
      valuationStatus: typeof item.valuationStatus === "string" ? item.valuationStatus : undefined,
      resolved: item.resolved === true || item.phase === "resolved", status: typeof item.status === "string" ? item.status : undefined,
      images: Array.isArray(item.images) ? item.images.filter((url): url is string => typeof url === "string" && /^https:\/\//.test(url)).slice(0, 3) : [],
    }));
    const active = markets.filter(m => !m.resolved && m.phase !== "cancelled" && (!m.endTime || m.endTime * 1000 > Date.now()));
    // Catalog prices are null by contract. Hydrate a bounded batch from live market detail.
    for (let offset = 0; offset < Math.min(active.length, 15); offset += 3) {
      await Promise.allSettled(active.slice(offset, offset + 3).map(async market => {
        const detail = await panta(`/markets/${encodeURIComponent(market.marketId)}/`, marketSchema);
        market.yesPrice = detail.yesPrice; market.noPrice = detail.noPrice;
        market.priceSource = typeof detail.priceSource === "string" ? detail.priceSource : undefined;
        market.valuationStatus = typeof detail.valuationStatus === "string" ? detail.valuationStatus : undefined;
        market.resolved = detail.resolved === true || detail.phase === "resolved";
        market.phase = detail.phase;
      }));
    }
    return { status: "connected", markets, checkedAt: new Date().toISOString(), nextCursor: listing.nextCursor || null,
      scanned: listing.items.length, message: "Live sports market data from Panta. Match rules require host review before trading in Sober." };
  } catch (error) {
    return { ...empty, status: "unavailable", message: error instanceof PantaError && [401, 403].includes(error.status)
      ? "Panta authentication failed. The host needs to check the API key."
      : "Panta could not be reached. Retry shortly." };
  }
}
