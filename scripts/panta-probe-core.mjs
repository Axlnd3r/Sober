export async function probePanta(base, key, request = fetch, wallet) {
  function validMarket(item) {
    if (!item || typeof item !== "object" || typeof item.marketId !== "string" || typeof item.title !== "string" || typeof item.category !== "string" || typeof item.phase !== "string") return false;
    for (const field of ["yesPrice", "noPrice", "primaryYesPrice", "primaryNoPrice"]) {
      if (item[field] !== undefined && item[field] !== null && typeof item[field] !== "string") return false;
    }
    for (const field of ["startTime", "endTime", "resolutionTime"]) {
      if (item[field] !== undefined && item[field] !== null && typeof item[field] !== "number") return false;
    }
    return true;
  }
  const headers = { Accept: "application/json", "X-Api-Key": key };
  async function get(path) {
    const response = await request(`${base.replace(/\/$/, "")}${path}`, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(`${path} returned an invalid JSON object`);
    return body;
  }

  const account = await get("/account/");
  if (typeof account.canCreateMarkets !== "boolean") throw new Error("/account/ response has no create permission field; account contract needs review");
  const catalog = await get("/markets/");
  if (!Array.isArray(catalog.items)) throw new Error("/markets/ response has no items array; catalog adapter needs review");
  if (catalog.items.some(item => !validMarket(item))) {
    throw new Error("/markets/ contains a market that does not match Sober's required fields");
  }
  const seenCursors = new Set();
  let cursor = catalog.nextCursor;
  let catalogPages = 1;
  let catalogPrimaryCount = catalog.items.filter(item => item.phase === "primary").length;
  while (cursor && catalogPages < 5 && catalogPrimaryCount === 0) {
    if (typeof cursor !== "string" || seenCursors.has(cursor)) throw new Error("/markets/ pagination cursor is invalid or repeated");
    seenCursors.add(cursor);
    const page = await get(`/markets/?cursor=${encodeURIComponent(cursor)}`);
    if (!Array.isArray(page.items) || page.items.some(item => !validMarket(item))) throw new Error("/markets/ paginated response does not match Sober's market fields");
    catalogPrimaryCount += page.items.filter(item => item.phase === "primary").length;
    cursor = page.nextCursor;
    catalogPages++;
  }
  const primary = await get("/markets/?phase=primary");
  if (!Array.isArray(primary.items)) throw new Error("/markets/?phase=primary has no items array");
  if (primary.items.some(item => !validMarket(item))) throw new Error("/markets/?phase=primary contains invalid market fields");
  const primaryFilterHonored = primary.items.every(item => item.phase === "primary");
  let detailChecked = false;
  if (catalog.items.length) {
    const first = catalog.items[0];
    const detail = await get(`/markets/${encodeURIComponent(first.marketId)}/`);
    if (detail.marketId !== first.marketId || !validMarket(detail)) {
      throw new Error("/markets/{id}/ response does not match Sober's market detail fields");
    }
    detailChecked = true;
  }
  let positionsChecked = false;
  if (wallet) {
    const positions = await get(`/positions/?wallet=${encodeURIComponent(wallet)}`);
    if (positions.wallet !== wallet || !Array.isArray(positions.positions) || positions.positions.some(position =>
      !position || typeof position.marketId !== "string" || typeof position.side !== "string" ||
      typeof position.shares !== "string" || typeof position.phase !== "string" ||
      typeof position.claimable !== "boolean" || typeof position.claimed !== "boolean")) {
      throw new Error("/positions/ response does not match Sober's wallet holdings fields");
    }
    positionsChecked = true;
  }
  return { canCreateMarkets: account.canCreateMarkets, firstPageCount: catalog.items.length, catalogPages, primaryCount: catalogPrimaryCount, primaryFilterHonored, detailChecked, positionsChecked };
}
