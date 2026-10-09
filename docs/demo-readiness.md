# Sober demo readiness — 9 October 2026

The [Panta API Sidetrack brief](https://superteam.fun/earn/listing/panta-api-side-track) calls for a working demo or compelling prototype, meaningful Panta API integration, an explanation of the use case and integration, and submissions to both Colosseum and Superteam Earn in English. Judges assess API integration, technical execution, product experience, originality, impact potential and traction. Do not present internal tests as traction.

Sober's proposed use case is a football decision journal attached to a prediction market. A fan reads a sourced match brief, records a YES/NO view and reason before kickoff, sees fan forecasts separately from Panta prices, and can then review a Panta wallet transaction. This is the strongest product distinction to demonstrate. Market listings and a cinematic UI alone do not establish it.

## Verified now

- Shared Overview navigation and visual language across the primary routes; responsive browser checks on Match center, Saved matches, Panta markets and Positions at 390px had no horizontal overflow.
- TypeScript, production build and 15 unit tests passed locally. Both local PostgreSQL/HTTP integration suites passed, including notebook isolation, server-captured context, cutoff enforcement, snapshot binding and fixture-change handling.
- PostgreSQL is running again with migration 0007 applied. The local Arsenal–Leeds room is published, reviewed and mapped to Panta market `9ArgG5SQf9T6QbVWEjNwpBpNkdPjNWNTNB15nkdivv15`; trading remains paused. The [Premier League schedule](https://www.premierleague.com/en/news/4688862/fixture-amendments-for-premier-league-matches-in-october-and-november) and Panta's full-time question were checked on 9 October. The current market phase is secondary, which is outside Sober's implemented primary-buy flow.
- My notebook and saved forecast records are implemented. New saves retain the server's fixture context, available market prices, analyst snapshot ID and timestamps. A recorded cutoff cannot be extended by later forecast edits. Existing records without a context snapshot are identified honestly.
- Browser checks verified a practice save, notebook navigation, filtering, preserved unsaved text after refresh, JSON export contents without a full wallet address, and responsive widths from 320 to 1440px. Clipboard access was unavailable in the automation browser, so the fallback message was verified; the OS download completion event was not confirmed.
- Panta authenticated account endpoint accepted the configured key. The server and browser RPC endpoints returned the same configured genesis hash.
- The live Panta catalog is reachable. On the 9 October browser check, four sports markets had displayable questions. Prices appeared for some markets but varied between refreshes. This upstream snapshot is not evidence that a primary buy is available.

## Blocking a full live demo

- No user-approved wallet buy, indexed position, eligible claim, or paid create transaction has been demonstrated. The code paths and read-only probes are not proof of a completed transaction.
- The reviewed local room has no linked team-history analysis yet. Live analyst provider keys, deployment and scheduled jobs remain unverified. Evidence of external users or usage has not been established.

## Data freshness

Overview and Panta markets refresh every 60 seconds while visible and when the tab becomes visible. The server catalog retains each Panta page for up to 60 seconds, so these screens cannot promise an instantaneous upstream update. Match center and Saved re-render their reviewed room list and mapped Panta phases every minute while visible, on tab return and on reconnect. They remain curated rooms, not a complete copy of the Panta catalog.

Match rooms, Notebook and Positions follow the same visible-tab schedule. Match room refresh preserves unsaved text and saved receipts, exposes the last check time, and blocks trade preparation when room data is older than 90 seconds or its refresh fails. Positions polling pauses during claim preparation and pending claims. Browser/API responses containing personal records use `private, no-store`.

## Demo gate

Before recording the submission, verify the fixture and market phase again; connect team history; run a wallet sign-in and one user-approved primary buy on an eligible reviewed market through confirmed signature, Panta indexing and Positions. Show the saved forecast, Notebook and the distinction between fan signal and market price. Use an English narration and submit to both required destinations. If live trading cannot be completed, label the prototype and explain the precise boundary in the video and submission. See [demo script](demo-script.md).

For a separate fictional preview, run `npm run demo` and open `http://127.0.0.1:3001/matches/sample-room`. It uses browser-local practice records and does not change the live app's configuration. `npm run test:local` starts and stops isolated test servers on port 3100; it requires the local database and disables transaction features.
