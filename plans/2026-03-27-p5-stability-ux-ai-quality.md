# P5 stability, UX, and AI quality hardening

## Goal
Strengthen AlphaNexus for repeated daily use by improving measurable performance, reducing editing friction, making capture faster and more predictable on multi-display setups, and moving AI prompt / comparison behavior into centralized quality-governed paths.

## Scope
- Add timeline virtualization and image lazy loading on high-frequency surfaces.
- Reduce export path overhead without changing export content shape.
- Improve editing flow with quieter autosave feedback, stable undo/redo, block reorder persistence, clipboard-image-to-capture insertion, and a lightweight selection toolbar.
- Add configurable capture shortcut settings and multi-display capture selection while preserving the current local-first capture save path.
- Centralize AI prompt template management, inject similar-case recall into prompt context, and add a minimal multi-provider comparison / consensus-divergence view.

## Files expected to change
- `PLANS.md`
- `docs/AlphaNexus-PostKickoff-Implementation-Plan.md`
- `app/src/shared/ai/contracts.ts`
- `app/src/shared/capture/contracts.ts`
- `app/src/shared/contracts/workbench.ts`
- `app/src/preload/index.ts`
- `app/src/main/app-shell/ipc/register-ai-ipc.ts`
- `app/src/main/app-shell/ipc/register-capture-ipc.ts`
- `app/src/main/app-shell/ipc/register-workbench-ipc.ts`
- `app/src/main/ai/service.ts`
- `app/src/main/ai/prompt-builders.ts`
- `app/src/main/ai/adapters/base.ts`
- `app/src/main/ai/adapters/openai.ts`
- `app/src/main/ai/adapters/deepseek.ts`
- `app/src/main/ai/adapters/custom-http.ts`
- `app/src/main/capture/capture-service.ts`
- `app/src/main/capture/capture-shortcuts.ts`
- `app/src/main/capture/capture-overlay-window.ts`
- `app/src/main/db/repositories/workbench-context-mutations.ts`
- `app/src/main/db/repositories/workbench-note-mutations.ts`
- `app/src/main/storage/workbench.ts`
- `app/src/main/domain/workbench-service.ts`
- `app/src/main/export/service.ts`
- `app/src/renderer/app/pages/SettingsAiPage.tsx`
- `app/src/renderer/app/pages/CaptureOverlayPage.tsx`
- `app/src/renderer/app/features/session-workbench/useSessionWorkbench.ts`
- `app/src/renderer/app/features/session-workbench/hooks/useSessionWorkbenchActions.ts`
- `app/src/renderer/app/features/session-workbench/SessionEventColumn.tsx`
- `app/src/renderer/app/features/session-workbench/SessionCanvasColumn.tsx`
- `app/src/renderer/app/features/session-workbench/SessionWorkspaceColumn.tsx`
- `app/src/renderer/app/features/session-workbench/SessionWorkbenchNotesPanel.tsx`
- `app/src/renderer/app/features/trade/TradeThreadMediaStrip.tsx`
- `app/src/renderer/app/styles/session-workbench.css`
- `app/src/renderer/app/styles/event-stream.css`
- `app/src/renderer/app/styles/trade-detail.css`
- New small renderer/main helper modules for virtualization, lazy images, selection toolbar, capture settings, and prompt template management

## Invariants to preserve
- Renderer stays a consumer of preload APIs; no direct DB or provider ownership moves into renderer.
- Capture, annotation, event creation, and screenshot persistence remain local-first and do not depend on AI/network availability.
- User notes, AI output, and trade facts remain distinct.
- Existing event types, screenshot persistence paths, and delete/restore semantics remain compatible.
- Multi-provider comparison remains an analysis-layer view only; it does not write new trade facts.

## Migration / compatibility strategy
- Contract changes are additive only:
  - capture preference APIs
  - display listing / selection for snip capture
  - clipboard-image capture insertion
  - prompt template listing / saving
  - content block reorder API
- No SQL schema migration is planned in this scope.
- New local settings files default to current behavior when absent:
  - capture shortcut falls back to the existing accelerator
  - display selection falls back to current-display capture behavior
  - prompt templates fall back to built-in template defaults
- Existing screenshots, AI runs, and content blocks remain readable without backfill.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`
- Regression additions for:
  - preload / IPC contract alignment
  - virtual timeline windowing
  - block reorder persistence
  - clipboard image insertion
  - capture settings and display targeting helpers
  - prompt template storage / loading
  - similar-case prompt context assembly
  - multi-provider comparison data assembly

## Rollback notes
- Reverting this scope should be safe because changes are additive and config-file based.
- If capture settings or prompt template files cause issues, deleting those local JSON files should restore default behavior.
- If renderer UX changes regress, the new helper modules can be reverted without touching persisted user data.
