# AlphaNexus Session Workbench Page Split

## Goal
Split `src/renderer/app/pages/SessionWorkbenchPage.tsx` into smaller renderer feature modules so the current local-first workbench stays easier to extend without changing behavior.

## Scope
- Extract Session workbench state and async actions into a dedicated hook.
- Extract the page header and the three main layout columns into feature components.
- Keep the current route, CSS class names, IPC usage, and shared contract shapes unchanged.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-session-workbench-page-split.md`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\session-workbench-types.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkbenchHeader.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionEventColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionCanvasColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkspaceColumn.tsx`

## Invariants to preserve
- Session workbench route and rendered layout remain intact.
- Existing button actions, tab behavior, annotation save flow, and content block delete/restore flow remain intact.
- Shared contracts, IPC contracts, and public payload field names stay unchanged.
- Capture, annotation, and export remain usable without AI or network access.

## Migration / compatibility strategy
- Keep `SessionWorkbenchPage.tsx` as the route-level composition entry.
- Move logic behind feature-local components and a hook without renaming public props or class names.
- Reuse the current `alphaNexusApi` flow instead of introducing a second renderer data layer.

## Tests to run
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Inline the extracted components and hook back into `SessionWorkbenchPage.tsx`.
- Delete the new `features/session-workbench` folder if any integration issue outweighs the maintainability gain.
