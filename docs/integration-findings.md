# Panta integration findings

## Current checks — 8 October 2026

This section supersedes the historical checks below.

| Item | Observed result |
| --- | --- |
| Database | Docker PostgreSQL connected; migrations 0001–0006 applied. |
| Panta discovery | Authenticated account/catalog/detail/positions probe passed. First catalog page contained 20 entries, seven sports entries and two entries labeled primary. Phase and actual start/end times are checked locally because upstream filtering is unreliable. |
| Public football preview | TheSportsDB returned Arsenal vs Leeds United on 10 October, 11:30 UTC. A schedule preview does not publish or map a match room. |
| Primary market checked | `C86nbpSX4ntRWvN4HMrdnhzHjHTtLooNtnw6k7hnmx1F` (Saka fantasy-points question). It is not a home-win match market and was not mapped to a Sober room. |
| Network | Checked account was absent on devnet and present on mainnet. Both local RPC endpoints now return mainnet genesis `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`. |
| Observed market owner | `6gM5afTQBq5VZCfgpGqcsqzfWd5maLSCKWtGjbEobZMp`; mainnet market account had 2982 bytes. |
| Observed USDC mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, checked as six decimals. |
| Unsigned buy spike | A 1 USDC primary quote and build both returned HTTP 200 with the expected schema. No signing, broadcast, submit or paid action occurred. |
| Observed programs in buy | Panta owner above; associated-token program `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`; memo program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`. This is not an audited exhaustive create/claim allowlist. |
| Local room state | No published match room; existing Everton–Chelsea manual draft remains unpublished and paused. |
| Write flags | Buy, claim and create all remain disabled. Public RPC endpoints are suitable for this local read-only demonstration, not a production capacity plan. |

Home discovery and `/markets` now read Panta directly even when there are no published rooms. The home price widget accepts a reviewed market mapping or an exact dated home-win question for the same teams; it does not infer a trade mapping from a partial team-name match.

### Analysis provider

The [Groq free plan](https://console.groq.com/docs/rate-limits) offers rate-limited API access. The adapter defaults to `openai/gpt-oss-20b`. Per [Groq structured-output documentation](https://console.groq.com/docs/structured-outputs), the agent separates a restricted evidence-reading tool call from a strict structured-output call. It can select only existing evidence IDs; it cannot invent statistics or call trading tools. Model failure yields an explicitly labeled statistical brief.

The football-data.org history adapter uses completed regular-time matches before the fixture cutoff. Its [free plan](https://www.football-data.org/pricing) has competition and request limits; live account history access is not yet verified. Both provider keys remain empty. Local mock tests passed for history filtering, immutable snapshots, admin-only generation, caching, source selection, cutoff and forecast snapshot binding. A real Groq generation and real history response have **not** been run.

## Historical checks — 6–7 October 2026

Checked 6–7 October 2026 against the [official Panta Quickstart](https://github.com/Kaito-HQ/panta-api-pub/blob/main/quickstart.mdx), [official public docs repository](https://github.com/Kaito-HQ/panta-api-pub), [authentication guide](https://github.com/Kaito-HQ/panta-api-pub/blob/main/guides/authentication.mdx), and [official playground](https://github.com/Kaito-HQ/panta-api-playground). The docs index and authentication guide were readable; individual endpoint examples could not be read in this environment, so exact response schemas have not been independently checked against live API responses.

| Item | Finding |
| --- | --- |
| API base | Quickstart uses `https://live-api.panta.market/api/v1`. Authenticated routes accept `X-Api-Key`; trailing slashes are required. |
| Key prefix | Quickstart says `pk_test_` and `pk_live_` both work on the public API. A test prefix does not establish the Solana cluster. |
| Create permission | Authenticated `/account/` returned `canCreateMarkets: true` for the new local account. This does not quote or pay a creation fee. |
| Flow distinction | The playground describes buy as quote, build, sign, submit/verify; win claim as build, sign, broadcast; create as quote, build, sign, register. |
| Network/genesis | Both configured public devnet RPC URLs returned the same genesis hash. Devnet follows the official playground's `.env.example`; Panta's actual deployed network and transaction compatibility remain unverified. |
| USDC mint | Unknown. No verified mint has been configured. |
| Panta program IDs | Unknown. No authoritative allowlist or IDL has been configured. |
| Response shapes | Authenticated account, market catalog, market detail, and empty-wallet positions responses matched the fields Sober uses. Quote/build/submit/claim/create response shapes remain unobserved. |
| Read-only probe | `npm run probe:panta` passed against the live API on 7 October: account authenticated; create permission enabled; catalog, detail, and empty-wallet positions matched Sober's read schemas. The first five catalog pages contained no `primary` market. A `phase=primary` query returned other phases, so Sober must inspect returned phase values itself. It also passed a local mock test. |
| Create fee and permissions | Permission was confirmed, but no fee quote or paid create was requested. |
| Buy/claim/positions | Empty-wallet positions read succeeded. No user wallet approval or eligible position was available. No signature or actual holdings can be reported. Public devnet RPC is configured for local development only. |

The adapter uses server-only Panta credentials. `APP_MODE=simulation` returns a clearly fictional room and does not call transaction endpoints. Live operations require explicit feature flags and configured RPC/network values. They remain unverified until a user-approved transaction and upstream verification succeed.

## Football-data.org v4, checked 7 October 2026

The official [competition matches reference](https://docs.football-data.org/general/v4/competition.html) documents `GET /v4/competitions/{code}/matches` with `dateFrom` and `dateTo`; the [match reference](https://docs.football-data.org/general/v4/match.html) documents `GET /v4/matches/{id}`. Requests use server-side `X-Auth-Token`. The [provider policy](https://docs.football-data.org/general/v4/policies.html) notes rate limits and that match list data can omit deeper details. Sober defaults to competition `PL`, fetches a bounded date range, validates each fixture, and re-fetches a selected ID before draft import. It does not invent form, scores, or official resolution URLs.

`FOOTBALL_API_KEY` is not configured in the current local environment. No actual 2026 fixture response, provider plan entitlement, or import has been verified. Imported rooms remain unpublished with no resolution sources until a host reviews and adds them. The provider's `SCHEDULED` status means kickoff is provisional, so Sober requires `TIMED` before market actions. A changed kickoff or non-final status pauses trading on a subsequent write check or scheduled sync.

The bounded fixture sync route is now implemented and tested with a local mock. It checks imported rooms in small batches, records a review issue for changed kickoff, teams, competition, or non-final status, and pauses trading without rewriting a reviewed room or market rule. `FOOTBALL_API_BASE_URL` may point to a local mock in development; production always uses the official endpoint. A deployment scheduler and a real provider response are still needed.

Next validation should compare RPC genesis with the intended Panta network, record the mint and program IDs, check actual quote/build response bodies, then run a user-approved buy with signature recovery and Panta verification. Do not turn on create before fee and permission review.
