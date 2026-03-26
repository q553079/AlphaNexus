# AlphaNexus Period Review, Export, and Mainline E2E Closure

## Goal
Tighten the last vertical layer on top of the current Period Review work: make period review feel less placeholder-like when real data exists, make Session Markdown export reflect the trade-thread spine, and add one deterministic end-to-end regression that guards the core local-first workflow.

## Scope
- Enrich period review aggregation and UI with clearer real-data summaries that expose the session/trade spine instead of only disconnected metric panels.
- Upgrade existing Session Markdown export so it serializes the session context, event spine, trade threads, screenshots, original notes, AI summaries, and review draft/exit review.
- Add one end-to-end regression that uses real services/storage/db/export with temp data directories and a deterministic AI path.
- Keep the work on the existing export surface and existing regression runner.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-27-period-review-export-e2e-closure.md`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\evaluation\evaluation-service.ts`
- `D:\AlphaNexus\app\src\main\feedback\feedback-service.ts`
- `D:\AlphaNexus\app\src\main\rules\rules-service.ts`
- `D:\AlphaNexus\app\src\main\profile\profile-service.ts`
- `D:\AlphaNexus\app\src\main\training\training-service.ts`
- `D:\AlphaNexus\app\src\main\review\review-service.ts`
- `D:\AlphaNexus\app\src\main\export\markdown.ts`
- `D:\AlphaNexus\app\src\main\export\service.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\PeriodReviewPage.tsx`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\period-review-regression.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\session-mainline-e2e.test.mjs`

## Invariants to preserve
- Export remains local-first and only reads from existing local DB / vault state.
- Basic capture, event creation, note persistence, and trade lifecycle remain independent from AI/network availability.
- Existing public field names, IPC channel names, and event types stay stable unless additions are strictly additive.
- Tests keep using temporary DB / vault / export directories and must not touch workspace data.

## Migration / compatibility strategy
- Prefer additive payload/query fields instead of renaming or replacing current review/export structures.
- Reuse existing period review service outputs and trade detail derivations instead of inventing a parallel stats layer.
- Keep Session Markdown export entry point the same and enhance the rendered markdown structure.
- Use deterministic local AI artifact creation in the E2E regression rather than depending on networked providers.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the new period-review summary wiring and fall back to the current metric-only presentation.
- Revert Session Markdown to the simpler session/event/note/image layout.
- Remove the added end-to-end regression and its registration from the regression runner.
