# AlphaNexus Session Workbench Real-Data Increment

## Goal
Move the Session workbench from mock-only behavior toward a usable local-first workflow by fixing the native SQLite runtime path, wiring renderer reads through real IPC-backed storage, and adding minimal content-block editing, soft delete, and restore flows for the right-side workbench.

## Scope
- Stabilize Electron dev runtime for `better-sqlite3`.
- Preserve the existing bootstrap and renderer shell while shifting Session workbench reads/writes to the local database.
- Add minimal content-block mutation contracts and IPC handlers.
- Support editing the session realtime-view note through a persisted content block.
- Support soft delete and restore for content blocks.
- Keep Markdown export aligned with persisted workbench content.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-session-workbench-real-data.md`
- `D:\AlphaNexus\app\package.json`
- `D:\AlphaNexus\app\src\main\index.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\main\db\migrations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\services\workbench\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\storage\database.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\shared\contracts\content.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`

## Invariants to preserve
- AlphaNexus stays local-first.
- Renderer does not directly own persistence logic.
- Core Session/Trade/Event/Screenshot schemas remain explicit and typed.
- Existing session bootstrap and mock seed remain valid for empty databases.
- Capture, annotation, and event persistence still work without AI availability.
- Existing renderer pages and route layout remain intact.

## Migration / compatibility strategy
- Keep preload IPC as the main contract boundary.
- Extend shared contracts with additive mutation inputs and outputs instead of replacing existing payloads.
- Preserve `session.my_realtime_view` for compatibility, but derive and persist the editable workbench note through `content_blocks`.
- Keep the renderer fallback mock API available if preload is missing, but prefer the real `window.alphaNexus` bridge whenever available.
- Add only additive database migration steps and avoid destructive rewrites.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev` smoke run
- Manual check:
  - load Session workbench
  - edit a persisted note
  - reload and confirm it persists
  - soft delete and restore the note
  - export Session Markdown and confirm note content is included

## Rollback notes
- Revert content-block mutation contracts and IPC handlers.
- Revert the new migration and repository mutation helpers.
- Revert SessionWorkbench editor wiring to the previous read-only mock behavior.
- If native rebuild changes prove unstable, revert any script changes and keep the prior bootstrap while investigating ABI/toolchain compatibility separately.
