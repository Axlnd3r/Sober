"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
type Status = { panta: string; rooms: number; mapped: number; published: number; network: string; trading: boolean; claims: boolean; create: boolean; football: boolean; ai: boolean; aiModel: string; schedulerSecret: boolean };
export function IntegrationStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  async function load() { setError(""); try { setStatus(await api<Status>("/api/admin/integration")); } catch { setError("Could not check integrations. Sign in with an admin wallet and retry."); } }
  useEffect(() => { void load(); }, []);
  return <section className="content-panel admin-section"><h2>Integration readiness</h2>
    {error ? <p role="alert">{error}</p> : !status ? <p role="status">Checking integration configuration…</p> : <>
      <p>Panta API: <strong>{status.panta}</strong> · Configured network: {status.network}</p><p>{status.mapped} mapped markets · {status.published} published rooms · {status.rooms} room drafts and publications.</p>
      <p>Buy: {status.trading ? "Enabled" : "Disabled"} · Create: {status.create ? "Enabled" : "Disabled"} · Claims: {status.claims ? "Enabled" : "Disabled"}</p>
      <p>Football history: {status.football ? "Key configured" : "Key missing"} · Groq: {status.ai ? `Key configured (${status.aiModel})` : "Key missing"} · Job authentication: {status.schedulerSecret ? "Configured" : "Missing"}</p>
      {!status.football && <p>Get a free <a className="text-link" href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer">football-data.org key</a> and set FOOTBALL_API_KEY in the server environment.</p>}
      {!status.ai && <p>Get a free-plan <a className="text-link" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq API key</a> and set GROQ_API_KEY. Generation uses a shared cache; provider limits still apply.</p>}
      {!status.mapped && <p>Browse the Panta catalog below, select a matching market, then review its exact question and rules against a room. API connectivity alone does not create a match mapping.</p>}
    </>}
    <button className="button-secondary" onClick={() => void load()}>Check integrations</button>
  </section>;
}
