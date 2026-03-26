# AlphaNexus Trade Lifecycle Closure

## Goal
Implement a real Session Workbench trade lifecycle so a session can complete open, add, reduce, and close actions with append-only event audit history and an up-to-date trade snapshot.

## Scope
- Additive contract updates for trade lifecycle mutations and new event types needed for `trade_add` and `trade_reduce`.
- Repository, storage, domain, IPC, preload, and renderer API support for open/add/reduce/close trade actions.
- Session workbench UI updates for a minimal usable trade lifecycle form and actions.
- Current-trade resolution updates so the app consistently prefers the current open trade and otherwise falls back to the latest trade.
- Regression, mock, export, and display updates so event stream, trade detail, AI attribution, and markdown export all understand the full lifecycle.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-trade-lifecycle-closure.md`
- `D:\AlphaNexus\app\src\shared\contracts\event.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-workbench-ipc.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\workbench-api.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\mock-runtime.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\hooks\useSessionWorkbenchActions.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\modules\session-workbench-selection.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkspaceColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\ui\display-text.ts`
- `D:\AlphaNexus\app\src\main\export\markdown.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- `D:\AlphaNexus\app\src\shared\mock-data\session-workbench.ts`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`

## Invariants to preserve
- Existing `trade_close` naming, current schema versioning, existing delete/restore flows, and current public payload fields remain intact.
- Core capture, annotation, event save, and local persistence continue to work without AI or network access.
- Every trade lifecycle mutation writes an audit event with the correct `trade_id` while also updating the persisted trade snapshot for reads.
- Trade detail, session event stream, and AI trade attribution remain consistent off the same stored trade and event records.
- No new production dependencies are introduced.

## Migration / compatibility strategy
- Use additive contract changes only: keep existing event types and payloads, and add lifecycle-specific inputs and `trade_add` / `trade_reduce`.
- Reuse the existing repository/storage/domain layering instead of adding parallel write paths.
- Keep renderer mock behavior aligned with real API shape and current-trade rules so tests and local mock runs remain representative.
- Avoid schema migration unless implementation proves current columns are insufficient.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the new trade lifecycle plan entry from `PLANS.md`.
- Revert additive trade lifecycle IPC/API methods and UI controls.
- Revert repository lifecycle mutations and current-trade resolution back to the previous snapshot-only behavior.
