# AlphaNexus Trade Detail Design-Near Upgrade

## Goal
Upgrade `TradeDetail` from a basic thread viewer into a design-near trade thread page that clearly separates setup / manage / exit evidence, original plan, AI advice, execution, deviation analysis, result evaluation, and next improvements.

## Scope
- Expand `TradeDetailPayload` additively so the trade thread is explicitly layered instead of inferred ad hoc in the page.
- Reuse existing query, evaluation, feedback, and review services to assemble trade-scoped sections.
- Redesign the renderer trade detail page and related trade components/styles to match the design intent more closely.
- Keep all data strictly scoped by `trade_id`.
- Update mock trade detail payloads if the shared contract changes.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-trade-detail-design-near.md`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\evaluation\evaluation-service.ts`
- `D:\AlphaNexus\app\src\main\feedback\feedback-service.ts`
- `D:\AlphaNexus\app\src\main\review\review-service.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\TradeDetailPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\trade\TradeThreadMediaStrip.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\trade\TradeReviewDraftPanel.tsx`
- Necessary new trade detail child components and dedicated styles
- Mock trade detail builders/data if payload changes affect them
- Trade detail regression coverage

## Invariants to preserve
- No schema migration, IPC rename, or public field rename; only additive contract changes.
- No change to capture, trade mutation, delete/restore, or review-draft write-path behavior.
- Trade detail data must stay strictly filtered by `trade_id` and must not leak session sibling trades.
- Original records and after-the-fact review content remain visibly separated and never overwrite each other.

## Migration / compatibility strategy
- Keep existing `TradeDetailPayload` fields for compatibility and add explicit layered fields needed by the upgraded page.
- Derive setup / manage / exit grouping from current screenshot/event data using transparent heuristics already aligned with Prompt 4.
- Build review/result/improvement sections from existing evaluation, feedback, and review draft artifacts instead of introducing a new write model.
- Update mock runtime and seed data to emit the new additive payload shape.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the new plan entry from `PLANS.md`.
- Revert the additive trade detail payload fields, query/service assembly, page redesign, and mock/test updates.
