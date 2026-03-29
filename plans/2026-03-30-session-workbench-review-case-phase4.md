## Goal
- Add `review_case / segment` persistence so a selected event range or pinned set can be saved, reopened, and restored inside the existing `SessionWorkbench`.

## Scope
- Add SQLite tables and migration for `review_cases`, `review_case_events`, and snapshot storage.
- Add shared contracts plus workbench IPC/domain/storage/repository methods to save, list, and reopen review cases.
- Connect the existing selection and analysis tray state so a saved case can restore workbench context without a new top-level page.
- Add minimal renderer UI in the left event rail for saving and reopening cases.

## Files Expected To Change
- `PLANS.md`
- `app/src/main/db/migrations.ts`
- `app/src/main/db/repositories/workbench-review-cases.ts`
- `app/src/main/db/repositories/workbench-repository.ts`
- `app/src/main/storage/workbench.ts`
- `app/src/main/domain/workbench-service.ts`
- `app/src/main/app-shell/ipc/register-workbench-ipc.ts`
- `app/src/preload/index.ts`
- `app/src/shared/contracts/review-case.ts`
- `app/src/shared/contracts/workbench.ts`
- `app/src/renderer/app/features/session-workbench/useSessionWorkbench.ts`
- `app/src/renderer/app/features/session-workbench/SessionEventColumn.tsx`
- `app/src/renderer/app/pages/SessionWorkbenchPage.tsx`
- related session-workbench styles/components as needed

## Invariants To Preserve
- `Electron + React + SQLite` skeleton stays unchanged.
- `SessionWorkbenchPage` remains the main entry; no new top-level page system.
- Existing single-event open/select/view/edit flows keep working.
- AI remains assistive; saved cases restore auditable local context instead of becoming a separate fact source.
- Existing workbench APIs stay additive where possible.

## Migration / Compatibility Strategy
- Use additive tables only; do not alter or remove existing session/event tables.
- Store a compact snapshot JSON for restoring `eventSelection` and `analysisTray` state.
- Keep legacy `selectedEvent` behavior derived from restored `primaryEventId`.
- Load saved cases separately from the main session payload to avoid destabilizing current workbench fetch contracts.

## Tests To Run
- `npm run typecheck`
- `npm run build`
- manual save/reopen validation in `SessionWorkbench`

## Rollback Notes
- Renderer save/reopen hooks can be disabled without affecting core session persistence.
- New tables are additive; rollback is limited to removing IPC wiring and renderer entry points if needed.
