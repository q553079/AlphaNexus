# AlphaNexus Trade Thread Review Draft

## Goal
Upgrade `TradeDetail` from a minimal read-only detail view into a basic trade thread that shows setup/manage/exit evidence, original notes, AI context, execution events, and an auto-generated review draft.

## Scope
- Additive `TradeDetailPayload` expansion for trade-scoped screenshots, content blocks, execution events, linked AI cards, and the current review draft block.
- Query-layer enrichment so `TradeDetail` loads only records belonging to the requested `trade_id`, with screenshot grouping for setup / manage / exit.
- Trade review draft upsert logic that uses existing `markdown` content blocks and keeps original records separate from retrospective review content.
- Auto-trigger review draft initialization/update when a trade closes or when an exit screenshot is saved.
- Renderer and mock updates so the new trade thread structure renders consistently in real and mock modes.
- Regression coverage for trade-scoped filtering and draft auto-generation.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-trade-thread-review-draft.md`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-trade-mutations.ts`
- `D:\AlphaNexus\app\src\main\review\review-service.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-save-flow.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\TradeDetailPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\trade\TradeReviewDraftPanel.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\trade\TradeThreadMediaStrip.tsx`
- `D:\AlphaNexus\app\src\shared\mock-data\session-workbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\mock-runtime.ts`
- `D:\AlphaNexus\app\scripts\regression\workbench-regression.test.mjs`

## Invariants to preserve
- Original notes, screenshots, AI outputs, and retrospective review content stay distinct and do not overwrite each other.
- Existing event types, content block types, public payload fields, and IPC contracts remain intact; changes are additive only.
- Capture save still persists screenshot / event / note locally before any optional AI call.
- Trade detail keeps strict `trade_id` scoping and never leaks session-wide records from other trades.
- No new production dependencies are introduced.

## Migration / compatibility strategy
- Reuse existing `markdown` content blocks for the review draft, identified by stable trade-scoped context and title instead of introducing a new block type.
- Keep auto-draft generation idempotent by upserting a single trade review draft on both close-trade and exit-screenshot flows.
- Extend mock payload/runtime to match the real API shape so renderer behavior stays aligned in both modes.
- Avoid schema migrations unless repository implementation proves current tables cannot support stable trade review draft identification.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the plan entry from `PLANS.md`.
- Revert the additive trade-detail payload fields and renderer sections.
- Revert review-draft upsert hooks from trade close and exit screenshot save paths.
