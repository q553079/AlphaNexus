# AlphaNexus Snip Capture Shortcuts

## Goal
Upgrade the screenshot entry flow from file import only to a first-pass Snipaste-style area capture with keyboard shortcuts, while preserving the current local-first event write path and session ordering behavior.

## Scope
- Add a fullscreen capture overlay window driven by Electron native capture APIs.
- Register a quick-launch accelerator for snip capture.
- Support copy-without-close and send-to-current-context shortcuts inside the capture overlay.
- Keep screenshot persistence on the existing `screenshot -> event stream` write path.
- Keep current session/context selection and refresh the workbench after capture is saved.
- Maintain a consistent saved capture height and stable workbench preview height.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-snip-capture-shortcuts.md`
- `D:\AlphaNexus\app\src\shared\capture\contracts.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\main\index.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-service.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-overlay-state.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-overlay-window.ts`
- `D:\AlphaNexus\app\src\main\capture\capture-shortcuts.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\router.tsx`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\window.d.ts`
- `D:\AlphaNexus\app\src\renderer\app\ui\AppFrame.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\CaptureOverlayPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\capture\CapturePanel.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\styles\global.css`

## Invariants to preserve
- AlphaNexus remains local-first.
- Screenshot capture still works without AI availability.
- Session event ordering and content-block `sort_order` behavior remain unchanged.
- Screenshot save still results in a session event and a locally stored image file.
- Existing import-from-file flow remains available as a fallback.

## Migration / compatibility strategy
- Additive IPC and shared contracts only.
- Reuse existing screenshot repository mutations instead of changing event/content ordering logic.
- Keep the current renderer workbench route and refresh it after a saved snip via an IPC event.
- Use Electron built-ins only; no new production dependency.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run dev`
- Manual:
  - `Ctrl/Cmd+Shift+4` opens the snip overlay
  - drag-select region
  - `Ctrl/Cmd+Shift+C` copies and keeps overlay open
  - `Ctrl/Cmd+Shift+Enter` saves into the current session
  - saved screenshot appears in SessionWorkbench event stream
  - workbench stays on the expected session and ordering remains intact

## Rollback notes
- Unregister the global shortcut and remove the overlay route/window.
- Revert the additive capture IPC methods.
- Keep the original file-import capture path as the stable fallback.
