# AlphaNexus Capture Overlay MVP

## Goal
Upgrade the existing snip capture overlay from a pure crop-and-send surface into the MVP design-state entry point: show the current target, allow a quick note, and support save, save+AI, and save-as-exit without making base persistence depend on AI.

## Scope
- Extend capture pending/save contracts so overlay save actions can carry structured current context, note text, AI intent, and capture kind overrides.
- Persist screenshot first, then persist any note/event linkage locally, then optionally trigger the existing single-AI analysis flow.
- Show current target and note composer inside the capture overlay page.
- Keep the existing copy path intact.
- Update preload, renderer API, mock API, and regression coverage for the new capture overlay behavior.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-capture-overlay-mvp.md`
- `D:\AlphaNexus\app\src\shared\capture\contracts.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-overlay-state.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-service.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-capture-ipc.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\mock-runtime.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\CaptureOverlayPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\capture\CaptureOverlayComposer.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\capture-overlay.css`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`

## Invariants to preserve
- Screenshot persistence, event creation, and note persistence remain local-first and do not require AI or network.
- Save order remains deterministic: screenshot local write -> event save -> optional note block save -> optional AI.
- Existing copy path and existing capture IPC channel names remain intact.
- Existing annotation and delete/restore flows remain unaffected.
- Existing public fields stay stable unless additions are strictly additive.

## Migration / compatibility strategy
- Keep existing capture request/response fields and extend them additively.
- Extend `savePendingSnip` input and result instead of replacing the existing contract.
- Reuse existing workbench/content persistence helpers where possible rather than adding a separate capture-only storage path.
- If AI fails during save+AI, return the base saved screenshot/note result and surface AI failure separately instead of rolling back local persistence.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Revert the capture contract additions and overlay composer UI.
- Revert capture save path back to screenshot-only persistence.
- Remove overlay-specific regression coverage and mock API behavior.
