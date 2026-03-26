# AlphaNexus Round 5 Feedback And Rules

## Goal
Add evidence-backed feedback, discipline scoring, setup leaderboards, and a transparent rule engine MVP on top of the evaluation layer.

## Scope
- Extend shared contracts for structured feedback items, discipline scoring, setup performance, and rule hits.
- Attach trade-level coaching and period-level leaderboard summaries to existing payloads.
- Keep feedback actionable and auditable rather than motivational or vague.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-round-5-feedback-and-rules.md`
- `D:\AlphaNexus\app\src\shared\contracts\evaluation.ts`
- `D:\AlphaNexus\app\src\shared\contracts\knowledge.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\TradeDetailPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\PeriodReviewPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\global.css`
- New local feedback/rules services under `D:\AlphaNexus\app\src\main\feedback\...` and `D:\AlphaNexus\app\src\main\rules\...`

## Invariants to preserve
- Feedback never mutates original trade/session records.
- Rule hits are explainable and can be turned off.
- Discipline scoring must surface evidence, not opaque math.
- Setup leaderboards must show sample size alongside performance.

## Migration / compatibility strategy
- Add flat payload sections for feedback, discipline, rule hits, and setup rankings.
- Default to empty arrays / null summaries when there is not enough data.
- Keep the review UI quiet by limiting the number of surfaced items.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`

## Rollback notes
- Hide feedback/rules cards while preserving evaluation outputs.
- Disable custom rules and fall back to built-in summaries if the MVP rule engine is noisy.
