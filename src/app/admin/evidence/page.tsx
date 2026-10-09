import Link from "next/link";
import { session } from "@/lib/auth";
import { mode } from "@/lib/config";
import { dbPool } from "@/lib/db";

export const dynamic = "force-dynamic";

const stamp = (value: Date | string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
const address = (value: string) => `${value.slice(0, 5)}…${value.slice(-5)}`;

export default async function EvidencePage() {
  const admin = mode === "live" ? await session().catch(() => null) : null;
  if (!admin?.admin) return <div className="container utility-page"><div className="page-heading"><h1>Admin access</h1><p>Sign in with an allowlisted wallet to view operational evidence.</p></div></div>;

  const [counts, recent, fixtures, usage] = await Promise.all([
    dbPool().query(`SELECT
      count(*) FILTER (WHERE kind='buy' AND chain_status='confirmed' AND panta_status='confirmed')::int AS verified_buys,
      count(*) FILTER (WHERE kind='buy' AND chain_status='confirmed' AND panta_status='confirmed' AND attribution_status='processed')::int AS attributed_buys,
      count(*) FILTER (WHERE kind='claim' AND chain_status='confirmed')::int AS chain_confirmed_claims,
      count(*) FILTER (WHERE kind='create' AND state='confirmed' AND chain_status='confirmed')::int AS registered_creates,
      count(*) FILTER (WHERE signature IS NOT NULL AND state IN ('signed','submitted','reconciliation_required'))::int AS pending_signatures
      FROM intents`),
    dbPool().query(`SELECT i.id,i.wallet,i.kind,i.state,i.signature,i.chain_status,i.panta_status,i.attribution_status,i.error_code,i.created_at,
      r.home_team,r.away_team FROM intents i LEFT JOIN rooms r ON r.id=i.room_id
      WHERE i.signature IS NOT NULL OR i.state='reconciliation_required'
      ORDER BY i.created_at DESC LIMIT 50`),
    dbPool().query(`SELECT id,home_team,away_team,provider_status,fixture_issue,fixture_synced_at FROM rooms
      WHERE fixture_issue IS NOT NULL ORDER BY fixture_synced_at DESC NULLS LAST LIMIT 20`),
    dbPool().query("SELECT event,internal,count(*)::int AS events,count(DISTINCT wallet)::int AS wallets FROM usage_events GROUP BY event,internal ORDER BY event,internal"),
  ]);
  const totals = counts.rows[0];
  const stats = [
    ["Verified buys", totals.verified_buys],
    ["Attributed buys", totals.attributed_buys],
    ["Claims confirmed on-chain", totals.chain_confirmed_claims],
    ["Registered creates", totals.registered_creates],
    ["Pending signatures", totals.pending_signatures],
  ];

  return <div className="container utility-page admin-page">
    <section className="content-panel admin-section"><h2>Observed wallet activity</h2><p>Signed-in wallet events are deduplicated per room, event and UTC day. Internal wallets are counted separately. These counts do not prove unique people or external traction.</p>{usage.rows.length ? <ul>{usage.rows.map(row => <li key={`${row.event}-${row.internal}`}>{row.event}: {row.events} daily events from {row.wallets} wallets · {row.internal ? "Internal/admin" : "Unclassified"}</li>)}</ul> : <p>No signed-in room views, analysis views or shares have been recorded.</p>}</section>
    <div className="page-heading"><span className="eyebrow">HOST / EVIDENCE</span><h1>Operational evidence</h1><p>Counts come from stored intents and verified signatures. They are not traffic or external-user metrics. No trade volume is shown without verified base-unit amounts.</p><Link className="text-link" href="/admin">Back to administration</Link></div>
    <section className="content-panel admin-section"><h2>Transaction status</h2><div className="evidence-stats">{stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p className="muted">A submitted transaction is pending until chain and Panta status agree. Claims can remain ahead of position indexing.</p></section>
    <section className="content-panel admin-section"><h2>Recent signatures and unresolved intents</h2>{recent.rows.length === 0 ? <p className="muted">No signed transactions or unresolved intents are recorded.</p> : <div className="evidence-table-wrap" tabIndex={0} aria-label="Transaction evidence table; scroll horizontally on small screens"><table className="evidence-table"><caption className="sr-only">Recent transaction evidence</caption><thead><tr><th scope="col">Created (UTC)</th><th scope="col">Kind / room</th><th scope="col">Wallet</th><th scope="col">Chain</th><th scope="col">Panta</th><th scope="col">Attribution</th><th scope="col">Intent / signature</th></tr></thead><tbody>{recent.rows.map(row => <tr key={row.id}><td>{stamp(row.created_at)}</td><td><strong>{row.kind}</strong><br/>{row.home_team ? `${row.home_team} vs ${row.away_team}` : "No room"}<br/><small>{row.state}</small></td><td>{address(row.wallet)}</td><td>{row.chain_status}</td><td>{row.panta_status}</td><td>{row.attribution_status}</td><td><code>{row.id}</code>{row.signature && <><br/><code>{row.signature}</code></>}{row.error_code && <><br/><small>{row.error_code}</small></>}</td></tr>)}</tbody></table></div>}</section>
    <section className="content-panel admin-section"><h2>Fixtures needing review</h2>{fixtures.rows.length === 0 ? <p className="muted">No imported fixture changes are flagged.</p> : <ul className="evidence-issues">{fixtures.rows.map(row => <li key={row.id}><strong>{row.home_team} vs {row.away_team}</strong><span>{row.fixture_issue} · {row.provider_status} · checked {row.fixture_synced_at ? stamp(row.fixture_synced_at) : "never"} UTC</span></li>)}</ul>}</section>
  </div>;
}
