import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { probePanta } from "../scripts/panta-probe-core.mjs";

test("read-only Panta probe validates authenticated account and catalog shape", async () => {
  let validCatalog = true;
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, path: req.url, key: req.headers["x-api-key"] });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/v1/account/") res.end(JSON.stringify({ canCreateMarkets: false }));
    else if (req.url === "/api/v1/markets/") res.end(JSON.stringify(validCatalog
      ? { items: [{ marketId: "m1", title: "Fixture", category: "sports", phase: "primary" }] }
      : { items: [{ marketId: "m1", title: "Fixture" }] }));
    else if (req.url === "/api/v1/markets/?phase=primary") res.end(JSON.stringify({ items: [{ marketId: "m1", title: "Fixture", category: "sports", phase: "primary" }] }));
    else if (req.url === "/api/v1/markets/m1/") res.end(JSON.stringify({ marketId: "m1", title: "Fixture", category: "sports", phase: "primary" }));
    else if (req.url === "/api/v1/positions/?wallet=test-wallet") res.end(JSON.stringify({ wallet: "test-wallet", positions: [] }));
    else { res.statusCode = 404; res.end("{}"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const success = await probePanta(base, "local-test-key", fetch, "test-wallet");
    assert.deepEqual(success, { canCreateMarkets: false, firstPageCount: 1, catalogPages: 1, primaryCount: 1, primaryFilterHonored: true, detailChecked: true, positionsChecked: true });
    assert.deepEqual(requests.map(({ method, path, key }) => ({ method, path, key })), [
      { method: "GET", path: "/api/v1/account/", key: "local-test-key" },
      { method: "GET", path: "/api/v1/markets/", key: "local-test-key" },
      { method: "GET", path: "/api/v1/markets/?phase=primary", key: "local-test-key" },
      { method: "GET", path: "/api/v1/markets/m1/", key: "local-test-key" },
      { method: "GET", path: "/api/v1/positions/?wallet=test-wallet", key: "local-test-key" },
    ]);
    validCatalog = false;
    await assert.rejects(probePanta(base, "local-test-key"), /required fields/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
