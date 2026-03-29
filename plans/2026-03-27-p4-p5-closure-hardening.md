# P4/P5 Closure Hardening

## Goal
- Formalize a rebuildable period domain for day/week/month review.
- Turn period review AI from a first-cut prompt path into a structured, explainable builder.
- Close the P5 AI quality gap with explicit failed-run tracking and period-level quality summaries.
- Keep aggregation and provider orchestration out of renderer.

## Scope
- Add a dedicated period review contract/model layer.
- Add main-side period rollup generation from existing local tables without a new SQL migration.
- Extend period review payloads with rollup, trade metrics, tag summaries, best/worst samples, AI review, and AI quality.
- Centralize period-review prompt building on structured rollup data.
- Record failed AI runs for quality tracking.
- Patch the period review page to read the new payload and expose the missing minimum design-state sections.

## Files expected to change
- `PLANS.md`
- `docs/AlphaNexus-PostKickoff-Implementation-Plan.md`
- `app/src/shared/ai/contracts.ts`
- `app/src/shared/contracts/workbench.ts`
- `app/src/shared/contracts/period-review.ts`
- `app/src/main/period/*`
- `app/src/main/review/review-service.ts`
- `app/src/main/feedback/feedback-service.ts`
- `app/src/main/profile/profile-service.ts`
- `app/src/main/storage/workbench.ts`
- `app/src/main/db/repositories/workbench-queries.ts`
- `app/src/main/db/repositories/workbench-repository.ts`
- `app/src/main/db/repositories/workbench-ai-mutations.ts`
- `app/src/main/ai/adapters/base.ts`
- `app/src/main/ai/adapters/openai.ts`
- `app/src/main/ai/adapters/deepseek.ts`
- `app/src/main/ai/adapters/custom-http.ts`
- `app/src/main/ai/prompt-builders.ts`
- `app/src/main/ai/service.ts`
- `app/src/renderer/app/pages/PeriodReviewPage.tsx`
- `app/src/renderer/app/features/review/*`
- `app/src/renderer/app/styles/global.css`
- `app/scripts/regression/*`

## Invariants to preserve
- Local-first storage remains authoritative.
- AI output stays separated into raw response, summary, and structured fields.
- Renderer does not own persistence, aggregation, or provider logic.
- Trade facts remain human/system records, never AI-only facts.
- Existing P0-P3 capture/session/trade chains stay compatible.

## Migration / compatibility strategy
- No SQL schema migration in this round.
- New period-domain objects are rebuildable contracts computed from existing `periods / sessions / trades / events / evaluations / ai_runs / analysis_cards`.
- `PeriodReviewPayload` changes are additive.
- Period-review AI continues to persist via existing `ai_runs + analysis_cards + content_blocks`; new structured period-review parsing reads `ai_runs.structured_response_json`.
- Failed AI runs reuse the existing `ai_runs.status = 'failed'` enum and do not require a new table.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Revert the new period-domain files and additive payload fields together.
- If needed, period review page can fall back to the older rollup sections because the old evaluation/feedback/profile/training services remain intact.
- Failed AI run recording is additive; reverting the new writer leaves existing successful runs untouched.
