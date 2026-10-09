# Silent demo videos

`sober-panta-demo-v2.mp4` is the 126-second hackathon film. It has no voice or audio track. Run `node scripts/render-demo-video-v2.mjs` to regenerate it with Chrome or Edge. The opening football and field animation is original canvas artwork; the rest uses Sober product captures and clearly labeled transaction walkthroughs. No Pinterest footage or audio is copied.

| Time | Story | What the film establishes |
| --- | --- | --- |
| 0–9 s | Original football opening | Sober: the reason behind the call. |
| 9–22 s | Why | Market prices do not preserve an individual fan's reasoning. |
| 22–37 s | Overview | Fixture, cutoff and market context in one matchday view. |
| 37–52 s | Match | Brief, rules and sources give a prediction its meaning. |
| 52–67 s | Panta discovery | Live question, phase and prices when Panta quotes them. |
| 67–82 s | Notebook | Forecast and context can be revisited; the captured record is practice data. |
| 82–99 s | Buy walkthrough | Quote, wallet signature and verification are separate steps. |
| 99–113 s | Claim walkthrough | A resolved winning position and wallet signature are required. |
| 113–126 s | Difference | Panta's market signal beside a personal, time-stamped rationale. |

The buy and claim sections illustrate the implemented user path. They explicitly state that this capture contains no signed transaction or eligible claim; they are not evidence of a completed on-chain trade. Product captures date from October 2026, so prices in them are snapshots. A live transaction video can replace those sections only after a funded wallet and eligible market/position produce verifiable receipts.

The key claim for jurors is deliberately narrow: Sober combines a sourced football room, Panta market context, and a saved pre-match rationale. Forecasting is free; trades require wallet approval. Do not describe the current practice record as user traction or suggest that the video proves settlement.

## First cut

Run `node scripts/render-demo-video.mjs` from the project root to regenerate `sober-panta-demo-v1.mp4` and its poster. Chrome or Edge is required. If automatic browser launch is restricted, run with `--serve` and open `http://127.0.0.1:4319/` in Chrome or Edge. The video is 1280×720, about 43 seconds, and has no audio track.

| Time | Screen | On-screen point |
| --- | --- | --- |
| 0–5 s | Title | Before kickoff, make the call. |
| 5–13 s | Overview | Fixture and market context together. |
| 13–21 s | Markets panel | Panta question and captured prices. |
| 21–29 s | Overview match | Choose a side with context. |
| 29–37 s | Notebook | Save a reason; practice record is labelled. |
| 37–43 s | End card | Make your call. Own your reasoning. |

This first cut uses product screenshots captured in October 2026. Market prices in the footage are snapshots, not current quotes. The notebook screen is a practice example saved on the device. The film does not claim that a wallet transaction or live trading has been demonstrated.

Pinterest references can guide a second cut's pacing, typography, transitions and color treatment without changing the factual product flow.
