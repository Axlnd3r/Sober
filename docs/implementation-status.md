# Implementation status

## 9 October 2026 notebook and demo revision

PostgreSQL is restored and migration 0007 is applied. The local Arsenal–Leeds fixture is reviewed, published and mapped to the matching full-time Panta question; its secondary market is shown accurately and trading remains paused. The previous database outage below is historical.

New work includes the private My notebook route, server-captured decision context, saved forecast cards, copy/JSON export controls, preserved original cutoffs, and refresh on visible tabs for rooms, room lists, Notebook and Positions. Match room refresh preserves unsaved text and blocks trade preparation when room data is stale. The fictional demo can run separately on port 3001. TypeScript, production build, 15 unit tests and both local database/HTTP integration suites passed. Browser checks covered practice save, notebook navigation, filter behavior, refresh preservation, export payload and 320–1440px widths. OS clipboard access and download completion were not available for full confirmation in the automation browser.

Remaining live gates are team-history data, deployment/schedulers, a user-approved transaction on an eligible primary market, indexing/claim evidence where applicable, and external traction. See [demo readiness](demo-readiness.md) and [demo script](demo-script.md).

## 9 October 2026 revision

The Overview navigation, wallet control, typography and dark/red visual system now carry through Match center, Saved matches, Panta markets, Positions, Match room, admin and privacy pages. The catalog hides sports records that have no question and labels missing upstream prices as “Not quoted.” An unsigned visitor now sees the sign-in state on Positions rather than an Unauthorized error. Typecheck, production build and 13 unit tests pass. Browser checks at 390px found no horizontal overflow on the four primary interior pages.

The local live demo is not end-to-end ready: PostgreSQL failed its connection/migration check, so Match center and Saved cannot load published rooms. The Panta account and configured Solana RPCs are reachable and agree on genesis hash. The observed Panta catalog returned 34 sports records, of which four had titles; the checked details supplied no current YES/NO prices. No signed buy, claim or create transaction has been completed. See [demo readiness](demo-readiness.md) for the remaining demonstration gates.

## 8 October 2026 revision

This revision supersedes the historical table below.

| Work | Current status |
| --- | --- |
| Cinematic home UI | Implemented and browser checked: three photographs/slides, parallax, slice transitions, live countdown, price rings, accessible white drawer, club search, wallet entry, mobile layout. |
| Panta discovery | Actual authenticated sports catalog and prices work independently of room publication. Seven sports markets observed. |
| Network/build spike | Mainnet account owner and USDC checked; unsigned primary quote/build passed. Nothing signed or broadcast. |
| Transaction policy | Genesis, mint, owner, allowed programs, signer, quote amount and exact confirmed-message checks implemented. Full financial instruction decoding and live flows remain. |
| Match Analyst | Historical statistics, constrained Groq evidence selection, source links, immutable snapshots and forecast binding implemented and mock tested. Live model/history keys remain missing. |
| Usage evidence | Authenticated room/analysis/share events deduplicated daily. Internal and unclassified cohorts remain separate; no external traction or verified volume claimed. |
| Database | Migrations 0001–0006 applied. Auth/forecast and fixture/analysis integration checks passed locally. |
| Automated checks | Typecheck, production build and ten unit tests passed. Browser checked at 1440/1024/768/390/320 pixels; no overflow or uncaught exceptions. |
| Live completion | Needs real analysis keys, reviewed published room, wallet signing, deployment/schedulers and official submissions. |

## Historical revision — 7 October 2026

Updated 7 October 2026. `verified` means the stated local check ran; it never implies a live Panta transaction.

| Feature | Status | Evidence and remaining work |
| --- | --- | --- |
| FR01 Reversible penalty intro | removed by request | The user chose a direct football dashboard without an opening animation. |
| FR02 Match discovery | in progress | The local app now uses live database mode. The home dashboard shows a read-only upcoming Premier League fixture from TheSportsDB's free public API when there is no published room. Football-data.org v4 preview/import creates unpublished provider-linked drafts; import/sync passed against a local mock. No football-data.org key is available. One Everton vs Chelsea manual draft is stored unpublished and paused; it needs manual schedule review because provider sync does not cover it. |
| FR03 Match Room | in progress | Rules, brief, source links, market data and unavailable states are implemented. Live content and source review remain. |
| FR04 Wallet and signed-message auth | in progress | Nonce, signature verification, one-time consumption, sessions, and admin allowlist are coded. Local PostgreSQL/HTTP integration passed for nonce replay, session, and admin permissions on 7 October; a browser wallet click-through remains. |
| FR05 Primary buy | blocked | Quote/build/sign/broadcast/submit/status code exists. An authenticated Panta key now works for account and market reads; network/mint/program validation, user-approved buy, and observed quote/build schemas are missing. |
| FR06 Positions and eligible claim | blocked | Panta reads and claim flow are coded. Only positions mapped to Sober football rooms are shown; claim build checks the same mapping. No live holdings or eligible position is available. |
| FR07 Locked fan forecasts | in progress | Database upsert enforces cutoff and one row per wallet/room; creation and edit times are stored separately; simulation stores only in browser. Local PostgreSQL/HTTP create, edit, and cutoff assertions passed on 7 October. |
| FR08 Admin map/create | blocked | Admin page, fee quote/build/sign/register, room mapping and publish are coded. Panta account reports create permission enabled; fee quote, live transaction, and manual review evidence are missing. |
| FR09 Share and evidence | in progress | Direct room links and copy action exist. A protected `/admin/evidence` page now reads verified buy/claim/create counts, pending signatures, recent intent statuses, and fixture issues from the database. Room-view analytics, test/external cohorts, and verified volume remain unimplemented. |
| FR10 Sync and recovery | in progress | A secret-protected, leased reconciliation batch now checks stored buy/claim/create signatures, safe submit/registration retries, attribution, and unsigned quote expiry. No scheduler or live Panta transaction response is configured. End-to-end failure tests remain. |
| TypeScript and production build | verified | `npm run typecheck` and `npm run build` passed locally on 7 October 2026. |
| Transaction policy, money, and Panta probe unit tests | verified | `npm test` passed three tests on 7 October 2026. |
| Local PostgreSQL and integration tests | verified | Migrations 0001–0004 applied. `npm run test:db` and `npm run test:fixtures` passed on 7 October with local test-only wallets and a mock fixture provider. No live user wallet, real fixture, or Panta flow was exercised. |

Live readiness remains blocked. Keep transaction flags disabled until the external and test gates in [integration findings](integration-findings.md) and [on-chain integration](onchain-integration.md) are complete.
