export default function Privacy() {
  return <div className="container utility-page prose-page"><span className="eyebrow">SOBER / PRIVACY</span><h1>What we keep</h1>
    <p>Sober uses your public wallet address to sign you in. A login signature does not authorize a trade. In live mode, we store your public address, forecast text, login session, and transaction signatures needed to recover trade and claim status.</p>
    <h2>Forecasts and analysis</h2><p>Published reasons are visible with a shortened wallet address. You can edit your reason until the room cutoff. If you read a Match Analyst snapshot before saving, we attach its version to your forecast so you can revisit the same evidence later. In demo mode, forecasts stay in this browser only.</p>
    <p>My notebook lists forecasts for your signed-in wallet. New saves also retain the match question, cutoff, source links and Panta prices available at save time. Copying or downloading a record includes your reason and timestamps; it excludes your full wallet address. These exports are opinion records, not signed transaction proofs.</p>
    <p>The optional Groq analyst receives team statistics, fixture context, public sources and Panta market data. Your wallet address, login session and forecast text are not sent to Groq. Analysis snapshots are shared by the room and retained for comparison after the match.</p>
    <h2>Usage evidence</h2><p>For signed-in users, Sober records room views, analysis views and successful link-copy actions using the public wallet address. Each event is counted once per room per UTC day. Admin and configured test wallets are marked internal. These records help the host measure use; they do not establish unique people. Anonymous visits are not counted.</p>
    <h2>Transactions</h2><p>Your wallet signs transactions locally. The Panta API and Solana network handle market positions and settlement. Sober stores intent and public signature records for status checks. Panta API credentials stay on the server.</p>
    <h2>Questions</h2><p>For a deployed version, the host should publish contact details and a retention policy before accepting real users.</p>
  </div>;
}
