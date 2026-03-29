# Period Catalog Backfill And Scope Hardening

## Goal
- Make `day / week / month` period rows real local records instead of week-only placeholders.
- Keep `session.period_id` as the current-context week anchor, while letting period review read-models rebuild by period time range.
- Prevent period-review AI runs from silently falling back to the session's week scope when the user is on a day or month review.

## Scope
- Add a small main-side period record service for boundaries, canonical row creation, and historical backfill.
- Update period review read paths to scope sessions and trades by period window instead of `sessions.period_id`.
- Add `period_id` as an additive AI run input for `period-review`.

## Files Expected To Change
- `app/src/main/period/period-record-service.ts`
- `app/src/main/db/repositories/session-launcher-mutations.ts`
- `app/src/main/period/period-rollup-service.ts`
- `app/src/main/period/period-ai-quality-service.ts`
- `app/src/main/db/repositories/workbench-queries.ts`
- `app/src/main/evaluation/evaluation-service.ts`
- `app/src/main/rules/rules-service.ts`
- `app/src/main/storage/workbench.ts`
- `app/src/main/ai/service.ts`
- `app/src/shared/ai/contracts.ts`
- `app/src/renderer/app/pages/PeriodReviewPage.tsx`
- regression tests and implementation-plan doc

## Invariants To Preserve
- Local-first storage and rebuildability.
- `session.period_id` remains the current workbench period anchor to avoid breaking P0-P3 context routing.
- Renderer continues to consume period payloads; it does not compute aggregates or touch persistence directly.
- AI remains an analysis layer, not the fact source.

## Migration / Compatibility Strategy
- No SQL migration.
- New period rows are additive and rebuildable from existing session timestamps.
- Existing weekly data remains valid.
- Historical sessions gain day/month review coverage through backfill plus time-range period queries.

## Tests To Run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback Notes
- Revert the new period record service and time-range filters together.
- Keep `session.period_id` untouched so rollback does not require data repair.
