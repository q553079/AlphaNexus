# AlphaNexus Period Review Real Rollup

## Goal
Make `PeriodReview` load and render real aggregate results from existing local data and services instead of returning mostly placeholder arrays.

## Scope
- Keep the existing `PeriodReviewPayload` contract intact while moving real aggregation into the normal read path.
- Reuse the existing evaluation, feedback, rules, profile, and training services instead of adding a parallel statistics stack.
- Remove the current `feedback-service` dependency on `getPeriodReview(...)` so period aggregation can be composed without read-path recursion.
- Improve period page rendering so real highlight cards and rollups show when data exists, with a reasonable empty state only when the period is genuinely sparse.
- Add regression coverage for populated period review aggregation.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-period-review-real-rollup.md`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\feedback\feedback-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-workbench-ipc.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\PeriodReviewPage.tsx`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\period-review-regression.test.mjs`

## Invariants to preserve
- `PeriodReview` remains a read/projection surface and does not mutate sessions, trades, screenshots, notes, or AI records.
- Public payload fields, IPC channel names, and existing schemas stay additive-compatible; no silent renames.
- Local-first ownership remains unchanged; no aggregation step depends on cloud or AI availability.
- Existing evaluation / feedback / rule / profile / training services stay the source of truth for their derived sections.

## Migration / compatibility strategy
- Keep `PeriodReviewPayload` unchanged and inject real aggregates into `loadPeriodReview(...)` through internal repository/storage inputs.
- Leave safe placeholder fallbacks in the query layer so callers that do not inject insights still receive a valid payload.
- Simplify IPC assembly after the storage path already returns enriched data, instead of stacking a second merge layer on top.
- Avoid schema migrations by deriving from existing period, session, trade, analysis, evaluation, and knowledge data.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the plan entry from `PLANS.md`.
- Revert the storage/query enrichment and restore the IPC-side merge if the new read path introduces instability.
- Revert the period page empty-state/highlight changes independently from the backend aggregation changes if needed.
