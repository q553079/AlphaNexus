# AlphaNexus Target Selector Design-Near Increment

## Goal
Upgrade the current Target Selector MVP into a design-near version that supports current target, recent targets, searchable history, previous-period trade lookup, and auditable content-block retargeting without disturbing existing local-first write flows.

## Scope
- Extend target option discovery beyond the current session-only list to include recent targets, searchable session / trade history, and previous-period trade shortcuts.
- Add additive support for moving content blocks between session / trade targets and, when needed, period targets.
- Persist content-block move audit history with explicit from/to context fields and timestamps.
- Expose block-retarget operations through workbench storage/domain/IPC/preload/renderer APIs and keep mock/runtime behavior aligned.
- Add UI affordances for richer target selection and block retargeting in session, trade, and period surfaces.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-target-selector-design-near.md`
- `D:\AlphaNexus\app\src\main\db\migrations.ts`
- `D:\AlphaNexus\app\src\shared\contracts\content.ts`
- `D:\AlphaNexus\app\src\shared\contracts\session.ts`
- `D:\AlphaNexus\app\src\shared\contracts\current-context.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-current-context.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-workbench-ipc.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\mock-runtime.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\context\CurrentContextBar.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\context\TargetSelector.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkbenchHeader.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionCanvasColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkspaceColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\TradeDetailPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\PeriodReviewPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-workbench.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\trade-detail.css`
- `D:\AlphaNexus\app\src\shared\mock-data\session-workbench.ts`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\workbench-regression.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\target-selector-regression.test.mjs`

## Invariants to preserve
- Existing session / trade / screenshot / AI write paths remain local-first and do not gain AI or network dependencies.
- Existing public field names, event types, content block types, and IPC channel names remain intact; changes are additive only.
- Moving a content block does not implicitly move screenshots or restructure screenshot storage.
- Current launcher / home / session open flows keep working even if no richer target history is available yet.
- Existing delete / restore / trade lifecycle / capture overlay regressions remain green.

## Migration / compatibility strategy
- Add a dedicated move-audit table instead of overloading existing delete or review history.
- Keep `current_context` compatible for existing session / trade targeting; add richer target discovery separately, and add period targeting only where it materially reduces ambiguity.
- Treat block retargeting as a context-parent change, not as a screenshot or asset migration.
- Prefer clearing non-essential event attachment on cross-context block moves rather than mutating broader event or screenshot ownership.
- Keep mock runtime returning the same API shape as the bridge API after contract expansion.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the plan entry from `PLANS.md`.
- Revert the move-audit migration and related repository methods.
- Revert block-retarget IPC/API additions and renderer UI back to the current session/trade selector MVP.
