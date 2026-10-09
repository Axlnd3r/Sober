# QA results

## 8 October 2026 — current revision

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed after the cinematic UI and integration changes. |
| Unit checks | Ten passed: source/history filtering, evidence constraints, tool restrictions, dated fixture matching, exact money/signature rules and instruction policy. |
| Actual Panta read probe | Passed account, catalog, market detail and empty positions. Seven sports markets rendered in the browser. |
| Network and unsigned quote/build | Mainnet account/mint/genesis checks passed. Primary quote/build returned HTTP 200. No wallet signing or broadcast. |
| Fixture/analysis DB integration | Passed against the local mock: admin access, unpublished visibility, generation, cache, forecast snapshot, cutoff, fixture change pause, job auth and internal usage deduplication. |
| Auth/forecast DB integration | Passed with the isolated test server in non-fixture mode. An initial run against the fixture-mode server failed because its mock provider had already stopped; rerun used the documented no-provider configuration. |
| Desktop/mobile browser | Native Chrome CDP checks at 1440×900, 1024×900, 768×900, 390×844 and 320×844. No horizontal overflow or uncaught JavaScript exceptions. |
| Interactive UI | All three slides, ticking countdown, live Panta search, selection, four drawer tabs, Escape, returned focus, mobile navigation and reduced-motion preference passed. |
| Real model, history feed, wallet | Not run. Groq/history keys and a user-approved wallet flow remain required. |

Screenshots are in `docs/previews/sober-cinema-*.png`. `scripts/check-cinema.mjs` uses a temporary Chrome CDP instance on port 9334; `scripts/start-test-server.mjs` separates test output from the main app in `.next-tests`. Start the test server with `--fixtures` only for `npm run test:fixtures`; start without that option for `npm run test:db`.

## Historical checks

Environment: Windows workspace, Node.js 24.19.0, 6 October 2026. Local PostgreSQL and public Solana devnet RPC URLs are configured. No Panta key is available.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed after changing the TypeScript target to ES2020. |
| `npm test` | Passed: exact transaction-message/signature matching and USDC parsing. The test runner uses no child process because sandboxed process spawn is unavailable. |
| `npm run build` | Passed after fixing the invalid `Intl.DateTimeFormat` option combination. Build ran with permission for its worker processes. |
| Production HTTP smoke | Passed in simulation: `/`, `/matches`, `/matches/sample-room`, and `/admin` returned 200; `/api/rooms` returned the fictional sample; `/api/rooms/sample-room` reported buying unavailable; `/api/forecasts?roomId=sample-room` returned empty demo data. |
| Unauthenticated API access | `/api/admin/rooms` and `/api/orders/quote` returned 401. Demo auth nonce returned a demo-mode error. |
| Live buy/create/claim | Not run. Requires verified configuration and user wallet approval. |
| Football dashboard rendering | Chrome at 1440 × 900, 800 × 900, and 390 × 844 rendered the dashboard, stadium photo, and four labeled demo fixtures. No document overflow at 390 or 800 pixels. Screenshots inspected. |
| Dashboard interaction | Chrome search narrowed four fixtures to one; clearing search restored the list; saving a fixture and selecting Saved showed one match. `/saved` showed an empty state in a fresh browser. |
| Mobile match room | Chrome at 390 × 844 rendered the match room with document width 390; hero remains within the viewport. Full wallet click-through and accessibility review remain pending. |
| Local PostgreSQL | Docker `postgres:16-alpine` healthy on `127.0.0.1:5433`; generated credentials are stored in ignored local files. |
| Database migrations | `0001_init.sql` and `0002_forecast_created_at.sql` applied successfully. |
| Connection check | PostgreSQL connected and the rooms table is present. Both configured devnet RPC URLs returned the same genesis hash. Panta check is blocked on the API key. |
| Panta account setup script | Help command ran; no external signup or API key issuance was attempted because the account email is missing. |
| Wallet auth and forecast integration | Not run with a real wallet. |

These results establish compilation and narrow unit behavior only. They do not establish production readiness or a successful Panta integration.

## 7 October 2026 update

`npm run typecheck`, `npm test` (2 tests), and `npm run build` passed after adding the football provider adapter, admin fixture import, and reconciliation route. The production build required worker-process permission in this environment. Docker Desktop was started, migration 0003 applied, and `npm run test:db` passed against a local live-mode test server: nonce replay was denied; non-admin room/fixture writes were denied; the admin fixture preview returned a missing-key state; and forecast create, edit, unique row, and cutoff behavior matched the database. No real provider fixture, job run, or Panta transaction was claimed.

The next local check applied migration 0004 and ran `npm run test:fixtures` against a mock football-data.org response: admin import created an unpublished draft; a second job call was held by a database lease; a changed kickoff paused trading and appeared on the protected evidence page; re-import repaired the draft; a postponed match was flagged; and the job rejected a request without authorization. This verifies local control flow, not the provider's live 2026 feed. The fixture job has no deployed scheduler yet.

On 7 October, `npm test` passed three tests including the new read-only Panta probe against a local HTTP mock. `npm run probe:panta` exited before making any request because the local API key is missing. `npm run verify:connections` confirmed PostgreSQL and matching server/browser RPC genesis hashes, but reported the same missing key. Typecheck passed; no Panta transaction was attempted.

After the user supplied an account email, `npm run setup:panta` created an account and saved its credentials in ignored local files without printing them. `npm run probe:panta` then passed against authenticated account, market catalog, market detail, and empty-wallet positions endpoints. The account reports market creation permission enabled. `npm run verify:connections` passed database, account, and matching RPC genesis checks. No quote, wallet signature, broadcast, or paid create has run.

The Panta catalog probe checked five pages and found no market in `primary` phase. The `phase=primary` query returned non-primary rows, so it was treated as an untrusted filter. No primary-buy quote candidate was available in those pages; later pages were not scanned.

A local production server started with `APP_MODE=live` and transaction flags disabled. `GET /` rendered “Panta market feed connected” after the server read Panta, and `GET /api/rooms` returned HTTP 200. This verifies the live read path in Sober; it does not verify a football market mapping or transaction.

The user then authorized a new admin wallet. `npm run setup:admin-wallet` generated a Solana keypair and added its public address to the admin allowlist; a second run returned the same address without replacing the key. The private key is in an ignored local file and was not printed. Windows ACLs on the wallet file, `.env.local`, and the Panta account file were restricted to the current user, SYSTEM, and Administrators. No wallet extension has imported or signed with this key yet.

Because no football-data.org key is available, the [Premier League fixture announcement](https://www.premierleague.com/en/news/4688862/fixture-amendments-for-premier-league-matches-in-october-and-november) was checked for Everton vs Chelsea on 17 October 2026 at 12:30 BST. `npm run seed:manual-fixture` created a single unpublished, trading-paused database draft with the official schedule and matchweek result page as sources. No Panta market was created; this manual draft has no automatic provider change detection.
