# AlphaNexus Capture Overlay Design-Near Increment

## Goal
Upgrade the snip capture overlay from the MVP crop-and-note flow to a design-near capture entry: crop, inline annotate, record a note, choose the current target, then save locally with optional AI, while keeping the fast path local-first.

## Scope
- Extend capture save contracts additively so pending snip save can carry annotation payloads and explicit target context.
- Keep the main-side save flow authoritative and deterministic: local screenshot write -> event save -> optional note block save -> annotation persistence -> optional AI.
- Rework the overlay renderer into a shared capture editor flow that combines crop selection, annotation tools, note input, and target selection.
- Preserve the existing copy path and keep save-as-exit preferring the current open trade.
- Update mock/runtime behavior and regression coverage for annotation-aware overlay saves.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-27-capture-overlay-design-near.md`
- `D:\AlphaNexus\app\src\shared\capture\contracts.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-service.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-save-flow.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-context-mutations.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\CaptureOverlayPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\capture\CaptureOverlayComposer.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\annotation\AnnotationCanvas.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\capture-overlay.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\capture-overlay-composer.css`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\mock-runtime.ts`
- `D:\AlphaNexus\app\src\shared\mock-data\session-workbench.ts`
- `D:\AlphaNexus\app\scripts\regression\capture-overlay-regression.test.mjs`

## Invariants to preserve
- Base screenshot, event, note, and annotation persistence remain local-first and do not depend on AI or network success.
- Existing capture IPC channel names and current public payload fields remain stable; only additive fields are allowed.
- Existing copy behavior stays available and does not close the overlay.
- Existing delete/restore behavior for screenshots, annotations, and note blocks remains intact.
- Existing current-context and target-selector semantics stay the source of truth for target routing.

## Migration / compatibility strategy
- Extend `SavePendingSnipInput` additively instead of replacing any existing fields.
- Reuse `AnnotationSchema` and existing screenshot annotation persistence rather than inventing a capture-only annotation format.
- Keep renderer-side target switching explicit, but resolve and validate the final save target in main before any write.
- If AI fails after local save, return the saved local result with an `ai_error` instead of rolling back local artifacts.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Remove the additive capture contract fields for overlay annotations/target save.
- Revert the overlay page back to crop-only UI.
- Revert main-side save flow to screenshot + note persistence without overlay annotation handling.
- Remove overlay annotation regression coverage and related mock behavior.
