# AlphaNexus Current Context MVP

## Goal
Introduce an explicit, structured current context so Session Workbench defaults no longer depend on ad hoc `session_id + kind` or array order, and ship an MVP target selector for the current session and its trades.

## Scope
- Add a persisted current context structure with at least `contract_id`, `period_id`, `session_id`, `trade_id`, `source_view`, and `capture_kind`.
- Add workbench APIs to read, update, and list current target options for the active session.
- Make Session Workbench read and display current context, and allow switching between the current session and trades in that session.
- Make new note save, AI run, and capture defaults follow current context.
- Keep `sessions.context_focus` as a human-readable summary only; do not reuse it as structured state.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-current-context-mvp.md`
- `D:\AlphaNexus\app\src\main\db\migrations.ts`
- `D:\AlphaNexus\app\src\shared\contracts\current-context.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\shared\capture\contracts.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-overlay-state.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-service.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-current-context.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-context-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-workbench-ipc.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-capture-ipc.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\workbench-api.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\mock-runtime.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkbenchHeader.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\hooks\useSessionWorkbenchActions.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\modules\session-workbench-selection.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\modules\session-workbench-anchor-grounding.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\context\CurrentContextBar.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\context\TargetSelector.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-workbench.css`
- `D:\AlphaNexus\app\src\shared\mock-data\session-workbench.ts`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`

## Invariants to preserve
- Capture, annotation, event save, and local persistence remain local-first and do not require AI or network.
- Existing launcher and session open flow keep working without requiring a separate context setup step.
- `sessions.context_focus` stays a human-readable field only.
- Existing public field names and IPC channel names remain intact unless changes are strictly additive.
- Existing delete/restore and trade lifecycle behavior keep passing regression.

## Migration / compatibility strategy
- Add a dedicated `current_context` table instead of overloading session fields.
- Keep existing capture input fields and extend them additively with structured context fields.
- Return current context and target options through workbench payload and dedicated APIs so renderer can adopt the new model without breaking older callers.
- Keep current trade fallback logic as “explicit context trade first, otherwise open trade, otherwise latest trade”.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the `current_context` migration and repository paths.
- Revert workbench payload/API additions and renderer context UI.
- Revert note/AI/capture default target logic to the previous session-only fallback.
