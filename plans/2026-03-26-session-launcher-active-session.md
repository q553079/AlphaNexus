# AlphaNexus Session Launcher Active Session

## Goal
Replace the bootstrap home page with a real session launcher and change default session resolution so no-arg workbench and capture flows resolve to the latest active session instead of the earliest seeded session.

## Scope
- Add dedicated launcher contracts for home payload and create-session input/output.
- Add launcher query and mutation modules without expanding into a broader planning or aggregation system.
- Add launcher storage and domain services plus additive IPC handlers.
- Update default session resolution logic for workbench and capture fallback.
- Replace the bootstrap home page with a launcher view that can open the active session, list recent sessions, and create a new session from an existing contract.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-session-launcher-active-session.md`
- `D:\AlphaNexus\app\src\shared\contracts\launcher.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\session-launcher-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\session-launcher-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-utils.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\storage\session-launcher.ts`
- `D:\AlphaNexus\app\src\main\domain\session-launcher-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-service.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\HomePage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-launcher\**`

## Invariants to preserve
- AlphaNexus stays local-first and keeps the existing session workbench, capture, AI, and export flows intact.
- No database schema changes or new tables are introduced in this task.
- Default session resolution becomes newer and more useful, but existing session records remain untouched.
- Screenshot fallback and no-arg workbench loading both use the same default-session rule.
- Existing public field names, event types, and IPC names stay additive rather than being renamed.

## Migration / compatibility strategy
- Add a standalone `launcher.ts` contract instead of folding launcher business models into `workbench.ts`.
- Keep `workbench.ts` as the shared API surface and only add the new launcher namespace there.
- Reuse existing `sessions` and `periods` tables, with minimal week-period reuse/creation logic at mutation time.
- Keep seed data as-is; change only which session is treated as the default when no session id is passed.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `python tools_check_file_sizes.py`
- Manual:
  - home page no longer shows hardcoded sample ids
  - active session and recent sessions render
  - creating a session from an existing contract redirects to that session
  - opening the workbench without a session id resolves to the latest active session
  - capture fallback attaches to the newly created active session

## Rollback notes
- Revert the new launcher IPC surface and home-page renderer components.
- Restore the previous bootstrap home page.
- Restore the previous default-session resolver if the new behavior introduces regressions.
