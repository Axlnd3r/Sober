# Sober

Sober is a football prediction companion with a cinematic matchday interface, sourced match analysis, free forecasts, and Panta YES/NO market data. The default `simulation` mode uses labeled fictional fixtures and never sends a transaction.

## Current implementation — 9 October 2026

- The home page has full-screen photography, three editorial slides, countdown, a club rail and a market/analysis drawer. Its navigation, wallet control and dark/red visual language now continue through the interior pages. Fictional athletes and original crest illustrations avoid using real player photos or club artwork. The self-hosted font is Plus Jakarta Sans.
- Panta discovery is connected independently of published match rooms. On the 9 October browser check, four sports questions were displayable and quote availability varied between refreshes. Untitled records are hidden and unavailable prices are labeled “Not quoted.” Overview and Markets check again every 60 seconds while visible; catalog responses can be cached for up to 60 seconds.
- Local RPC configuration now matches observed Panta mainnet accounts. A live unsigned primary-buy quote and build succeeded. No transaction was signed or broadcast. Transaction flags default to disabled in `.env.example`; the ignored local `.env.local` can enable them for a wallet-controlled rehearsal.
- Match Analyst calculates form and historical statistics, then optionally uses Groq to select source-linked evidence. The free provider adapter is implemented; `GROQ_API_KEY` and `FOOTBALL_API_KEY` still need to be configured locally. Without the model key, available sourced data produces a clearly labeled statistical brief.
- Usage evidence stores deduplicated authenticated room, analysis and share events. Internal wallets are identified; other usage remains **unclassified**, not automatically external traction.
- My notebook retains saved forecasts for the signed-in wallet. New saves include server-captured fixture context, available Panta prices, analyst snapshot IDs and timestamps; records can be copied or exported. Recorded cutoffs cannot be extended by editing a forecast.
- PostgreSQL is running with migration 0007. One local reviewed Arsenal–Leeds room is published and mapped to the Panta full-time question; its market is secondary and trading remains paused. Match rooms, room lists, Notebook and Positions now refresh while visible without replacing an unsaved forecast draft.

Detailed checks and remaining submission work: [QA](docs/qa-results.md), [integration findings](docs/integration-findings.md), [demo readiness](docs/demo-readiness.md).

## Run locally

The local checks use Node.js 24.19 or newer, including its built-in TypeScript support for tests. Install dependencies with `npm ci`, then run `npm run dev` and open `http://localhost:3000`. The default mode needs no database or API key. `npm run typecheck`, `npm test`, and `npm run build` are the local checks.

`npm run demo` starts a separate fictional preview at `http://127.0.0.1:3001/matches/sample-room`; its practice forecasts stay in that browser and the live app's environment is unchanged. `npm run test:local` manages isolated test servers and runs both database/HTTP integration suites against local PostgreSQL. It uses test wallets and disables transaction features. The short [English demo script](docs/demo-script.md) describes what can be demonstrated honestly now.

For a live transaction rehearsal, run `npm run demo:preflight` before opening the local app. Add `-- --wallet <public Solana address>` to check that wallet's Panta claim eligibility without signing. The flags can be enabled individually in ignored `.env.local`; they never authorize a transaction by themselves. Follow the [live transaction demo runbook](docs/live-transaction-demo.md) for the current gates and wallet steps.

For a local database, start Docker Desktop, then run `npm run setup:local` once, `docker compose up -d db`, and `npm run db:migrate`. Setup creates ignored `.env.local` and `.env.db.local` files with a random database password. PostgreSQL listens only on `127.0.0.1:5433`. Existing environment files are never overwritten.

Setup configures the public Solana devnet RPC for local development, following the [official Panta playground example](https://github.com/Kaito-HQ/panta-api-playground/blob/main/.env.example). This is a starting configuration, not verification of Panta's deployed network. Public Solana RPCs have rate limits and [are not intended for production apps](https://solana.com/docs/references/clusters).

To create a new Panta account and key, run `npm run setup:panta -- your-email@example.com` with your own email address. The script follows the [official Panta signup and key flow](https://github.com/Kaito-HQ/panta-api-pub/blob/main/quickstart.mdx), generates a password, stores the login and key in ignored `.panta-account.local.json`, and writes `PANTA_API_KEY` into `.env.local`. Secrets are never printed. An uncertain key creation stops for review to prevent duplicate issuance. An existing account should instead use Panta login and key management; this script never resets an existing password. Keep the credentials file private.

For a local admin wallet, run `npm run setup:admin-wallet`. The idempotent script stores its base58 private key in ignored `.sober-admin-wallet.local.json`, prints only the public address, and adds that address to `ADMIN_WALLET_ALLOWLIST` in `.env.local`. Import the `secretKeyBase58` value into a Solana browser wallet yourself; the app never reads this file or signs on your behalf. Back up the private key securely before funding the address. This locally generated wallet is for development; use a separately managed wallet for production funds.

Run `npm run verify:connections` to check the database, Panta account endpoint, and whether both RPC URLs have the same genesis hash. Then confirm the network Panta actually uses. For production, configure a private server endpoint as `SOLANA_RPC_URL`, a browser-safe endpoint as `NEXT_PUBLIC_SOLANA_RPC_URL`, and its cluster name as `SOLANA_NETWORK`. A browser RPC URL must be approved for public use by its provider; never put a private RPC token or Panta key in a `NEXT_PUBLIC_` variable. Add your wallet address to `ADMIN_WALLET_ALLOWLIST` if you will manage rooms, and set `APP_URL` to the exact browser origin.

After configuring the key, run `npm run probe:panta`. It makes read-only authenticated calls to account, catalog, market detail, and empty-wallet positions endpoints; checks the fields Sober uses; and reports create permission without printing credentials. It never requests a quote or submits a transaction.

Leave `APP_MODE=simulation` and transaction flags disabled until the network, mint, program IDs, API responses, and wallet flow have been reviewed. Then `APP_MODE=live` enables database-backed rooms. No live transaction has been completed in this project.

Account, catalog, detail, empty positions, primary quote and unsigned buy-build shapes have been checked against the real API. Submit, verification, claim and paid creation still require a real wallet flow. See [integration findings](docs/integration-findings.md), [implementation status](docs/implementation-status.md), [on-chain integration](docs/onchain-integration.md), and [QA results](docs/qa-results.md).

For real football fixture drafts, add `FOOTBALL_API_KEY` to `.env.local` and optionally set `FOOTBALL_COMPETITION_CODE` (default `PL`). In live mode an allowlisted admin can preview the next 21 days at `/admin`, import one provider fixture at a time, and review its question, rule, and public resolution sources before mapping or publication. Importing creates no Panta market. The provider key stays on the server. Without it, the admin screen shows a configuration message. Apply migration `0003_fixture_import_and_jobs.sql` with `npm run db:migrate` before using the new live routes.

When `APP_MODE=live` and no published room exists, the home dashboard also shows a read-only Premier League schedule preview from [TheSportsDB free v1 API](https://www.thesportsdb.com/documentation). Its public key `123` needs no account; the free feed may return only one upcoming event. It does not import, review, publish, or map a Panta market. The football-data.org key is still needed for the existing admin import and fixture sync workflow. Run `npm run diagnose:dashboard` to see the local mode and room counts without exposing credentials, then restart the app after changing `.env.local`.

Without a football-data.org key, `npm run seed:manual-fixture` can create one idempotent Everton vs Chelsea draft for 17 October 2026 from the [Premier League schedule](https://www.premierleague.com/en/news/4688862/fixture-amendments-for-premier-league-matches-in-october-and-november). It starts unpublished and trading paused. Recheck the kickoff and resolution source manually before creating or publishing a Panta market; the provider sync cannot watch a manual draft.

The signed-intent reconciliation route is `POST /api/jobs/reconcile` with `Authorization: Bearer <JOB_SECRET>`. Configure a long random `JOB_SECRET` and an external scheduler for the deployment; the route processes a bounded batch under a database lease. It checks existing signatures and safe upstream associations; it never signs or broadcasts a transaction. With no configured Panta key or RPC, the job reports unavailable.

`POST /api/jobs/fixtures` uses the same job secret and a separate lease. Schedule it independently to recheck imported fixtures. Kickoff, team, competition, or status changes pause trading and appear under `/admin/evidence`; the host must review the room before resuming. The evidence page requires an allowlisted admin session. It reports stored signature/status counts and deduplicated authenticated usage; verified trade volume is not yet calculated.

For Match Analyst, add `GROQ_API_KEY` from [Groq Console](https://console.groq.com/keys) and `FOOTBALL_API_KEY` from [football-data.org](https://www.football-data.org/client/register) to `.env.local`. The default `AI_MODEL` is `openai/gpt-oss-20b`. Provider free tiers have rate and coverage limits. Never use a `NEXT_PUBLIC_` prefix for these keys. An admin can generate an analysis after importing a provider fixture. `POST /api/jobs/analysis` uses `JOB_SECRET` and refreshes one stale published match per invocation. Configure a deployment scheduler for all jobs. Analyses are immutable snapshots; a forecast saves the snapshot that was displayed when it was submitted.

`npm run test:db` exercises live HTTP auth, admin access, forecast edits, and cutoff against a local PostgreSQL database. Start the local database and run migrations first. In one terminal, start Next on port 3100 with `APP_MODE=live`, `APP_URL=http://localhost:3100`, and `ADMIN_WALLET_ALLOWLIST` set to the address printed by `node tests/database-integration.mjs --print-admin-wallet`. Keep transaction flags disabled. In another terminal run `npm run test:db`. The test inserts and removes its own fixture and uses fixed test-only wallets; run it only against a local database.

`npm run test:fixtures` checks fixture import, job authentication and lease behavior, change detection, and the evidence page with a local mock. Run the app in development on port 3100 with the same test admin wallet and set `FOOTBALL_API_KEY=local-fixture-test-key`, `FOOTBALL_API_BASE_URL=http://127.0.0.1:3201/v4`, and `JOB_SECRET=local-fixture-job-test-secret` in that process only. The test starts and stops the mock server itself. These values are test-only; production ignores the base-URL override and requires a real provider key.

## Routes

- `/`: cinematic football carousel with Panta market discovery, prices where supplied, fixture countdown, and an accessible details drawer.
- `/markets`: Panta sports catalog with filters, prices where supplied, descriptions, and pagination.
- `/matches` and `/matches/[id]`: match center, rules, free forecast, and Panta trade interface.
- `/saved`: football fixtures saved in this browser.
- `/notebook`: the signed-in wallet's saved forecasts, captured context and export controls; browser-local practice records in simulation mode.
- `/positions`: wallet holdings linked to Sober football rooms and eligible win claim interface.
- `/admin`: allowlisted wallet room management, integration diagnostics, market selection, analysis generation and creation interface.
- `/admin/evidence`: authenticated usage and transaction evidence, fixture review issues, and job status.
- `/privacy`: current data handling summary.

Wallet connection and signed-message login are separate. Forecasts are free. Panta transactions require a wallet signature and user approval. The server stores intents and checks transaction signatures before reporting buy, claim, or create completion.

## Live safeguards and current limits

`APP_MODE=live` is required for database-backed rooms. `TRADING_ENABLED`, `CLAIMS_ENABLED`, and `CREATE_ENABLED` each need an explicit `true` value and configured server RPC, public RPC, and network. Missing configuration keeps writes disabled. No code creates markets, buys positions, or claims without a wallet signature. Server credentials stay in server modules.

The current implementation still needs a real history-provider response and Groq request, a published and reviewed match mapping, deployed job scheduling, and a complete user-approved wallet flow. Program/mint/genesis checks exist, but they do not decode every financial instruction or constitute a contract audit. The allowlist was observed from a buy build; claim/create may require further verified programs. See [cinematic UI notes](docs/cinematic-ui.md) for the current visual direction.
