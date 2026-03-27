# AlphaNexus P0 Session Mainline Hardening

## Goal
Turn the current Stage 0 session path into a real P0 mainline: real session activation, real current context, real screenshot asset persistence, real editable workbench notes, one real image-capable AI path, DB-driven timeline, and markdown export that references the persisted local assets.

## Scope
- Remove bootstrap-time mock session seeding and keep only minimal local reference contract data so a new workspace starts empty but usable.
- Add a real "continue session / activate session" path and make current session status/context come from persisted state instead of mock ids or hardcoded routes.
- Extend screenshot persistence so each saved capture can trace raw image, annotated image, and annotation JSON while preserving existing screenshot/event relationships.
- Extend AI persistence so each completed run stores raw response text, prompt preview, and structured payload separately from summary cards and trade facts.
- Add the minimum user note block flow for the right workbench: create, auto-save, move target, soft delete, restore, and event visibility sync.
- Keep timeline and markdown export driven by real DB data and update them to surface the richer screenshot / AI artifacts.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-27-p0-session-mainline-hardening.md`
- `D:\AlphaNexus\app\src\main\storage\database.ts`
- `D:\AlphaNexus\app\src\main\db\migrations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\session-launcher-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\session-launcher-queries.ts`
- `D:\AlphaNexus\app\src\main\storage\session-launcher.ts`
- `D:\AlphaNexus\app\src\main\domain\session-launcher-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-launcher-ipc.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-context-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mappers.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-service.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-save-flow.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\openai.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- `D:\AlphaNexus\app\src\main\export\markdown.ts`
- `D:\AlphaNexus\app\src\shared\contracts\launcher.ts`
- `D:\AlphaNexus\app\src\shared\contracts\content.ts`
- `D:\AlphaNexus\app\src\shared\contracts\analysis.ts`
- `D:\AlphaNexus\app\src\shared\ai\contracts.ts`
- `D:\AlphaNexus\app\src\shared\capture\contracts.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\ui\AppFrame.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\HomePage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-launcher\SessionLauncherList.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\CaptureOverlayPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\hooks\useSessionWorkbenchActions.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkspaceColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\components\AnalysisCardView.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\annotation\annotation-utils.ts`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\capture-overlay-regression.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\session-mainline-e2e.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\workbench-regression.test.mjs`
- One new contract/regression test file
- One new renderer-side annotation export helper

## Invariants to preserve
- Capture, annotation, event creation, and local asset persistence must continue working without AI/network availability.
- Renderer stays a consumer of preload contracts; persistence and provider logic stay in main.
- AI output remains analysis-only and never overwrites user notes, trade facts, or event history.
- Existing event types and payload fields stay stable unless changes are strictly additive and documented.
- Screenshot, note, AI, and export paths remain local-first and auditable.

## Migration / compatibility strategy
- Apply only additive schema changes to `screenshots` and `ai_runs`, keeping legacy `file_path` / `asset_url` and existing analysis card fields readable.
- Replace mock session bootstrap data with minimal reference contract seeding so new installs still have create-session inputs without fabricated session history.
- Add explicit session activation/continue contracts instead of overloading renderer-only navigation state.
- Keep existing capture and AI IPC channels; extend their payloads additively for annotated asset data and richer AI audit fields.
- When note blocks are deleted, restored, or moved, synchronize their user-note events so the timeline never shows orphaned or phantom entries.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Restore mock session bootstrap seeding and remove reference-contract-only initialization.
- Revert screenshot / AI additive columns and fall back to single-path screenshot assets and summary-only AI persistence.
- Revert note-block creation/update contracts and keep the single realtime-view-only editor.
- Revert renderer workbench/export updates and the added regression coverage.
