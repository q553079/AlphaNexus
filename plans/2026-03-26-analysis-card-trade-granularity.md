# Analysis Card Trade Granularity

## Goal
- Stop reusing the latest session-level AI analysis across every trade in the same session.
- Persist trade attribution directly on `analysis_cards`.
- Make trade detail, AI vs Human, calibration, and period rollups evaluate only trade-scoped AI judgments.

## Scope
- Add `trade_id` to `analysis_cards` with an additive migration and backfill.
- Update AI persistence so new analysis cards store the selected trade association.
- Update repository mappers, contracts, and mock/seed data for the new field.
- Tighten evaluation queries so trade-level analytics only consume `analysis_cards.trade_id = trades.id`.

## Files expected to change
- `app/src/main/db/migrations.ts`
- `app/src/main/db/repositories/workbench-mutations.ts`
- `app/src/main/db/repositories/workbench-mappers.ts`
- `app/src/main/db/repositories/workbench-queries.ts`
- `app/src/main/db/repositories/workbench-seed.ts`
- `app/src/main/evaluation/evaluation-service.ts`
- `app/src/shared/contracts/analysis.ts`
- `app/src/shared/mock-data/session-workbench.ts`

## Invariants to preserve
- Session-level market analysis must still be viewable in session/workbench context.
- Trade facts, AI outputs, and evaluation records remain separate entities.
- Existing AI run persistence and event stream behavior stay append-friendly and auditable.
- No frontend-only patch should mask incorrect backend attribution.

## Migration / compatibility strategy
- Add `analysis_cards.trade_id` as nullable.
- Backfill from `ai_runs.event_id -> events.trade_id` where possible.
- Leave unresolved rows as `NULL`; treat them as session-level analysis and exclude them from trade statistics.
- Keep payload shape additive by extending `AnalysisCardSchema` with nullable `trade_id`.

## Tests to run
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Revert the new migration and code that reads `analysis_cards.trade_id`.
- Restore evaluation joins to previous behavior only if necessary for emergency recovery, knowing it will reintroduce incorrect session-wide attribution.
