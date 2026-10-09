import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import pg from "pg";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

process.loadEnvFile(".env.local");
const base = new URL(process.env.SOBER_TEST_BASE_URL || "http://localhost:3100");
const dbUrl = new URL(process.env.DATABASE_URL || "postgresql://missing");
if (!["localhost", "127.0.0.1"].includes(base.hostname) || !["localhost", "127.0.0.1"].includes(dbUrl.hostname)) {
  throw new Error("Fixture integration test requires a local app and database");
}
const adminKeypair = Keypair.fromSeed(Buffer.alloc(32, 42));
const providerId = randomInt(1_000_000_000, 2_000_000_000);
const roomId = `fd-${providerId}`;
const mockKey = "local-fixture-test-key";
const jobSecret = "local-fixture-job-test-secret";

async function request(path, method = "GET", body, cookie, authorization) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { Origin: base.origin, ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(authorization ? { Authorization: authorization } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, json: await response.json() };
}

test("fixture import, lease, schedule-change pause, and admin evidence", async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const leaseToken = randomUUID();
  let importedRoom = false;
  let fixture = {
    id: providerId,
    utcDate: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    status: "TIMED",
    lastUpdated: new Date().toISOString(),
    competition: { code: "PL", name: "Premier League" },
    homeTeam: { id: 1, name: "Test Home" },
    awayTeam: { id: 2, name: "Test Away" },
  };
  const mock = createServer((req, res) => {
    if (req.headers["x-auth-token"] !== mockKey) { res.writeHead(401).end(); return; }
    res.setHeader("Content-Type", "application/json");
    if (req.url?.startsWith("/v4/competitions/PL/matches?")) res.end(JSON.stringify({ matches: [fixture] }));
    else if (req.url === `/v4/matches/${providerId}`) res.end(JSON.stringify(fixture));
    else if (req.url?.startsWith("/v4/teams/")) {
      const teamId = Number(req.url.split("/")[3]);
      res.end(JSON.stringify({ matches: Array.from({ length: 6 }, (_, index) => ({
        id: teamId * 100 + index, utcDate: new Date(Date.now() - (index + 1) * 7 * 86400_000).toISOString(), status: "FINISHED",
        homeTeam: { id: teamId, name: `Test ${teamId === 1 ? "Home" : "Away"}` }, awayTeam: { id: 100 + index, name: `Opponent ${index}` },
        score: { duration: "REGULAR", fullTime: { home: teamId === 1 ? 2 : 0, away: index % 2 } },
      })) }));
    }
    else res.writeHead(404).end();
  });
  await new Promise(resolve => mock.listen(3201, "127.0.0.1", resolve));
  try {
    const existing = await client.query("SELECT 1 FROM rooms WHERE id=$1", [roomId]);
    assert.equal(existing.rowCount, 0, "random test room must not exist already");
    const wallet = adminKeypair.publicKey.toBase58();
    const nonce = await request("/api/auth/nonce", "POST", { wallet });
    assert.equal(nonce.response.status, 200, JSON.stringify(nonce.json));
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(nonce.json.data.message), adminKeypair.secretKey));
    const login = await request("/api/auth/verify", "POST", { nonceId: nonce.json.data.nonceId, signature });
    assert.equal(login.response.status, 200, JSON.stringify(login.json));
    assert.equal(login.json.data.admin, true);
    const cookie = login.response.headers.get("set-cookie")?.match(/sober_session=[^;]+/)?.[0];
    assert.ok(cookie);

    const preview = await request("/api/admin/fixtures", "GET", undefined, cookie);
    assert.equal(preview.response.status, 200, JSON.stringify(preview.json));
    assert.equal(preview.json.data.fixtures[0].providerId, providerId);
    const imported = await request("/api/admin/fixtures", "POST", { providerId }, cookie);
    assert.equal(imported.response.status, 201, JSON.stringify(imported.json));
    assert.equal(imported.json.data.id, roomId);
    importedRoom = true;
    const draft = await client.query("SELECT published,reviewed,sources,provider_fixture_id,fixture_issue FROM rooms WHERE id=$1", [roomId]);
    assert.equal(draft.rows[0].published, false);
    assert.equal(draft.rows[0].reviewed, false);
    assert.deepEqual(draft.rows[0].sources, []);
    assert.equal(Number(draft.rows[0].provider_fixture_id), providerId);

    const deniedAnalysis = await request(`/api/rooms/${roomId}/analysis`, "POST", {}, undefined);
    assert.equal(deniedAnalysis.response.status, 401);
    const hiddenAnalysis = await request(`/api/rooms/${roomId}/analysis`);
    assert.equal(hiddenAnalysis.response.status, 404, "draft analysis stays private");
    const generated = await request(`/api/rooms/${roomId}/analysis`, "POST", {}, cookie);
    assert.equal(generated.response.status, 200, JSON.stringify(generated.json));
    const analysis = generated.json.data.analysis;
    assert.equal(analysis.engine, "statistics");
    assert.equal(analysis.aiStatus, "unconfigured");
    assert.equal(analysis.snapshot.home.played, 6);
    assert.equal(analysis.snapshot.home.wins, 6);
    assert.equal(analysis.snapshot.away.draws, 3);
    const cached = await request(`/api/rooms/${roomId}/analysis`, "POST", {}, cookie);
    assert.equal(cached.json.data.analysis.id, analysis.id, "a fresh snapshot is reused");
    await client.query("UPDATE rooms SET published=true,reviewed=true WHERE id=$1", [roomId]);
    for (let attempt = 0; attempt < 2; attempt++) {
      const event = await request("/api/events", "POST", { roomId, event: "analysis_view" }, cookie);
      assert.equal(event.response.status, 200);
    }
    const events = await client.query("SELECT internal FROM usage_events WHERE room_id=$1", [roomId]);
    assert.equal(events.rowCount, 1, "usage events are deduplicated per wallet, room and UTC day");
    assert.equal(events.rows[0].internal, true, "admin activity is explicitly internal");
    const badAnalysis = await request("/api/forecasts", "POST", { roomId, side: "yes", reason: "Test evidence", analysisId: randomUUID() }, cookie);
    assert.equal(badAnalysis.response.status, 400, "forecast rejects missing snapshot");
    const savedForecast = await request("/api/forecasts", "POST", { roomId, side: "yes", reason: "Test evidence", analysisId: analysis.id }, cookie);
    assert.equal(savedForecast.response.status, 200, JSON.stringify(savedForecast.json));
    assert.equal(savedForecast.json.data.analysis_id, analysis.id);
    await client.query("UPDATE rooms SET cutoff_at=now()-interval '1 second' WHERE id=$1", [roomId]);
    const lateAnalysis = await request(`/api/rooms/${roomId}/analysis`, "POST", {}, cookie);
    assert.equal(lateAnalysis.response.status, 400, "generation is locked at cutoff");
    const historical = await request(`/api/rooms/${roomId}/analysis`);
    assert.equal(historical.json.data.locked, true);
    assert.equal(historical.json.data.analysis.id, analysis.id);
    await client.query("DELETE FROM fan_forecasts WHERE room_id=$1", [roomId]);
    await client.query("UPDATE rooms SET published=false,reviewed=false,cutoff_at=kickoff_at-interval '5 minutes' WHERE id=$1", [roomId]);

    const unauthorized = await request("/api/jobs/fixtures", "POST");
    assert.equal(unauthorized.response.status, 403);
    await client.query("INSERT INTO job_leases(name,token,expires_at) VALUES('fixtures',$1,now()+interval '2 minutes')", [leaseToken]);
    const busy = await request("/api/jobs/fixtures", "POST", undefined, undefined, `Bearer ${jobSecret}`);
    assert.equal(busy.response.status, 200);
    assert.equal(busy.json.data.busy, true);
    await client.query("DELETE FROM job_leases WHERE name='fixtures' AND token=$1", [leaseToken]);

    fixture = { ...fixture, utcDate: new Date(Date.parse(fixture.utcDate) + 60 * 60_000).toISOString(), lastUpdated: new Date().toISOString() };
    const changed = await request("/api/jobs/fixtures", "POST", undefined, undefined, `Bearer ${jobSecret}`);
    assert.equal(changed.response.status, 200, JSON.stringify(changed.json));
    assert.equal(changed.json.data.results.find(row => row.roomId === roomId)?.outcome, "kickoff_changed");
    const paused = await client.query("SELECT fixture_issue,trading_paused FROM rooms WHERE id=$1", [roomId]);
    assert.equal(paused.rows[0].fixture_issue, "kickoff_changed");
    assert.equal(paused.rows[0].trading_paused, true);

    const evidence = await fetch(new URL("/admin/evidence", base), { headers: { Cookie: cookie } });
    assert.equal(evidence.status, 200);
    assert.match(await evidence.text(), /Fixtures needing review/);
    const deniedEvidence = await fetch(new URL("/admin/evidence", base));
    assert.match(await deniedEvidence.text(), /Admin access/);
    const reimported = await request("/api/admin/fixtures", "POST", { providerId }, cookie);
    assert.equal(reimported.response.status, 201, JSON.stringify(reimported.json));
    const repaired = await client.query("SELECT fixture_issue,trading_paused,kickoff_at FROM rooms WHERE id=$1", [roomId]);
    assert.equal(repaired.rows[0].fixture_issue, null);
    assert.equal(repaired.rows[0].trading_paused, false);
    assert.equal(repaired.rows[0].kickoff_at.toISOString(), fixture.utcDate);

    fixture = { ...fixture, status: "POSTPONED", lastUpdated: new Date().toISOString() };
    const postponed = await request("/api/jobs/fixtures", "POST", undefined, undefined, `Bearer ${jobSecret}`);
    assert.equal(postponed.json.data.results.find(row => row.roomId === roomId)?.outcome, "kickoff_not_final");
  } finally {
    await client.query("DELETE FROM job_leases WHERE name='fixtures' AND token=$1", [leaseToken]);
    if (importedRoom) {
      await client.query("DELETE FROM fan_forecasts WHERE room_id=$1", [roomId]);
      await client.query("DELETE FROM match_analyses WHERE room_id=$1", [roomId]);
      await client.query("DELETE FROM rooms WHERE id=$1", [roomId]);
    }
    await client.query("DELETE FROM auth_sessions WHERE wallet=$1", [adminKeypair.publicKey.toBase58()]);
    await client.query("DELETE FROM auth_nonces WHERE wallet=$1", [adminKeypair.publicKey.toBase58()]);
    await client.end();
    await new Promise(resolve => mock.close(resolve));
  }
});
