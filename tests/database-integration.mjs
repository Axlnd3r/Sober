import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

process.loadEnvFile(".env.local");
const base = new URL(process.env.SOBER_TEST_BASE_URL || "http://localhost:3100");
const dbUrl = new URL(process.env.DATABASE_URL || "postgresql://missing");
if (!["localhost", "127.0.0.1"].includes(base.hostname) || !["localhost", "127.0.0.1"].includes(dbUrl.hostname)) {
  throw new Error("Database integration tests require a local app and local PostgreSQL");
}
const adminKeypair = Keypair.fromSeed(Buffer.alloc(32, 42));
const fanKeypair = Keypair.fromSeed(Buffer.alloc(32, 43));
if (process.argv.includes("--print-admin-wallet")) {
  process.stdout.write(`${adminKeypair.publicKey.toBase58()}\n`);
  process.exit(0);
}

async function request(path, method = "GET", body, cookie) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { Origin: base.origin, ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return { response, json };
}

async function signIn(keypair) {
  const wallet = keypair.publicKey.toBase58();
  const nonce = await request("/api/auth/nonce", "POST", { wallet });
  assert.equal(nonce.response.status, 200, JSON.stringify(nonce.json));
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(nonce.json.data.message), keypair.secretKey));
  const signed = await request("/api/auth/verify", "POST", { nonceId: nonce.json.data.nonceId, signature });
  assert.equal(signed.response.status, 200, JSON.stringify(signed.json));
  const cookie = signed.response.headers.get("set-cookie")?.match(/sober_session=[^;]+/)?.[0];
  assert.ok(cookie, "auth response sets a session cookie");
  return { wallet, cookie, nonceId: nonce.json.data.nonceId, signature, admin: signed.json.data.admin };
}

test("live auth, admin permission, one forecast per wallet, and cutoff enforce DB state", async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const roomId = `integration-${randomUUID()}`;
  const kickoff = new Date(Date.now() + 2 * 60 * 60_000);
  const cutoff = new Date(kickoff.getTime() - 5 * 60_000);
  try {
    await client.query(`INSERT INTO rooms(id,competition,home_team,away_team,kickoff_at,fixture_source_url,brief,cutoff_at,published,reviewed)
      VALUES($1,'Integration test','Test Home','Test Away',$2,'https://example.com/fixture','Test room',$3,true,true)`, [roomId, kickoff, cutoff]);
    const fan = await signIn(fanKeypair);
    assert.equal(fan.admin, false);
    const replay = await request("/api/auth/verify", "POST", { nonceId: fan.nonceId, signature: fan.signature });
    assert.equal(replay.response.status, 400, "nonce cannot be consumed twice");
    const fanAdmin = await request("/api/admin/rooms", "GET", undefined, fan.cookie);
    assert.equal(fanAdmin.response.status, 403);
    const fanImport = await request("/api/admin/fixtures", "POST", { providerId: 1 }, fan.cookie);
    assert.equal(fanImport.response.status, 403);

    const admin = await signIn(adminKeypair);
    assert.equal(admin.admin, true, "test server must allowlist the printed admin wallet");
    const adminRooms = await request("/api/admin/rooms", "GET", undefined, admin.cookie);
    assert.equal(adminRooms.response.status, 200);
    const importedFixtures = await request("/api/admin/fixtures", "GET", undefined, admin.cookie);
    assert.equal(importedFixtures.response.status, 200);
    if (!process.env.FOOTBALL_API_KEY) {
      assert.equal(importedFixtures.json.data.configured, false);
      const unavailableImport = await request("/api/admin/fixtures", "POST", { providerId: 1 }, admin.cookie);
      assert.equal(unavailableImport.response.status, 503);
    }

    const anonymousNotebook = await request("/api/notebook");
    assert.equal(anonymousNotebook.response.status, 401);
    const first = await request("/api/forecasts", "POST", { roomId, side: "yes", reason: "Home has the stronger form", decision_snapshot: { homeTeam: "Forged team", market: { yesPrice: "0.99" } } }, fan.cookie);
    assert.equal(first.response.status, 200, JSON.stringify(first.json));
    assert.equal(first.json.data.decision_snapshot.homeTeam, "Test Home", "context is captured by the server");
    assert.equal(first.json.data.decision_snapshot.market, null, "unmapped forecasts do not invent quotes");
    const created = await client.query("SELECT side,reason,created_at,updated_at FROM fan_forecasts WHERE room_id=$1 AND wallet=$2", [roomId, fan.wallet]);
    assert.equal(created.rowCount, 1);
    const second = await request("/api/forecasts", "POST", { roomId, side: "no", reason: "Changed my mind before kickoff" }, fan.cookie);
    assert.equal(second.response.status, 200, JSON.stringify(second.json));
    const edited = await client.query("SELECT side,reason,created_at FROM fan_forecasts WHERE room_id=$1 AND wallet=$2", [roomId, fan.wallet]);
    assert.equal(edited.rowCount, 1);
    assert.equal(edited.rows[0].side, "no");
    assert.equal(edited.rows[0].created_at.getTime(), created.rows[0].created_at.getTime());

    const notebook = await request("/api/notebook", "GET", undefined, fan.cookie);
    assert.equal(notebook.response.status, 200, JSON.stringify(notebook.json));
    assert.match(notebook.response.headers.get("cache-control"), /no-store/);
    const entry = notebook.json.data.entries.find(entry => entry.roomId === roomId);
    assert.equal(entry.forecast.reason, "Changed my mind before kickoff");
    assert.equal(entry.forecast.decision_snapshot.homeTeam, "Test Home");
    assert.equal(JSON.stringify(entry).includes(fan.wallet), false, "notebook records omit the full wallet address");
    const otherNotebook = await request("/api/notebook", "GET", undefined, admin.cookie);
    assert.equal(otherNotebook.json.data.entries.some(entry => entry.roomId === roomId), false, "wallets cannot read each other's notebooks");

    await client.query("UPDATE rooms SET cutoff_at=now()-interval '1 second' WHERE id=$1", [roomId]);
    const late = await request("/api/forecasts", "POST", { roomId, side: "yes", reason: "Too late to change" }, fan.cookie);
    assert.equal(late.response.status, 400);
    const locked = await client.query("SELECT side,reason FROM fan_forecasts WHERE room_id=$1 AND wallet=$2", [roomId, fan.wallet]);
    assert.equal(locked.rows[0].side, "no");
    assert.equal(locked.rows[0].reason, "Changed my mind before kickoff");
    await client.query("UPDATE fan_forecasts SET decision_snapshot=jsonb_set(decision_snapshot,'{cutoffAt}',to_jsonb(now()-interval '1 minute')) WHERE room_id=$1", [roomId]);
    await client.query("UPDATE rooms SET cutoff_at=now()+interval '1 hour' WHERE id=$1", [roomId]);
    const reopened = await request("/api/forecasts", "POST", { roomId, side: "yes", reason: "Try after reschedule" }, fan.cookie);
    assert.equal(reopened.response.status, 400, "extending the fixture schedule cannot unlock the recorded forecast");
    const ownRead = await request(`/api/forecasts?roomId=${encodeURIComponent(roomId)}`, "GET", undefined, fan.cookie);
    assert.equal(ownRead.json.data.mine.reason, "Changed my mind before kickoff");
    assert.equal(ownRead.json.data.reasons[0].decision_snapshot, undefined, "private snapshot is not included in the public reasons feed");
    await client.query("UPDATE rooms SET published=false WHERE id=$1", [roomId]);
    const hidden = await request(`/api/forecasts?roomId=${encodeURIComponent(roomId)}`);
    assert.equal(hidden.response.status, 404, "unpublished rooms do not expose public forecasts");
  } finally {
    await client.query("DELETE FROM fan_forecasts WHERE room_id=$1", [roomId]);
    await client.query("DELETE FROM rooms WHERE id=$1", [roomId]);
    for (const keypair of [adminKeypair, fanKeypair]) {
      await client.query("DELETE FROM auth_sessions WHERE wallet=$1", [keypair.publicKey.toBase58()]);
      await client.query("DELETE FROM auth_nonces WHERE wallet=$1", [keypair.publicKey.toBase58()]);
    }
    await client.end();
  }
});
