# AlphaNexus Round 4 Evaluation And Calibration

## Goal
Add auditable AI-vs-human evaluation, lightweight confidence calibration, and period rollup summaries without turning AlphaNexus into a noisy analytics dashboard.

## Scope
- Add shared evaluation contracts for trade-level judgments, calibration buckets, comparison metrics, and period review rollups.
- Extend existing trade detail and period review payloads with derived evaluation summaries.
- Compute results from existing local session / trade / analysis / evaluation records before introducing heavier persistence.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-round-4-evaluation-and-calibration.md`
- `D:\AlphaNexus\app\src\shared\contracts\evaluation.ts`
- `D:\AlphaNexus\app\src\shared\contracts\analysis.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\TradeDetailPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\PeriodReviewPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\global.css`
- New local evaluation/review services under `D:\AlphaNexus\app\src\main\evaluation\...` and `D:\AlphaNexus\app\src\main\review\...`

## Invariants to preserve
- AI correctness is never self-declared; derived outcomes must reference actual trade/session results.
- Human and AI judgments remain separate in the payloads.
- Missing or insufficient outcomes remain explicit instead of being coerced into a score.
- Review sections stay lightweight and subordinate to the event/trade workflow.

## Migration / compatibility strategy
- Add evaluation blocks as additive payload sections with safe empty states.
- Prefer derived rollups over new persistence in this round to reduce migration risk.
- Keep existing trade detail and period review rendering valid when evaluation data is absent.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`

## Rollback notes
- Hide evaluation panels while keeping underlying session, trade, and AI data untouched.
- Fall back to the pre-round-4 trade detail and period review layout if evaluation sections prove noisy.
