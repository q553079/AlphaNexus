# AlphaNexus Core Surface Split

## Goal
Split oversized renderer and main-shell surface files into smaller modules so Phase 1/2 work can land in clear locations without changing behavior.

## Scope
- Split `app/src/main/app-shell/register-ipc-handlers.ts` into grouped IPC registration modules for launcher, workbench, capture, ai, knowledge, and export.
- Split `app/src/renderer/app/bootstrap/api.ts` into grouped renderer API modules while preserving current real/mock behavior.
- Split `app/src/renderer/app/features/session-workbench/useSessionWorkbench.ts` into focused modules for data loading, selection state, actions, suggestions, and anchor-grounding helpers.
- Extract session workbench, event stream, and capture overlay styles from `app/src/renderer/app/styles/global.css` into dedicated style files and import them from `App.tsx`.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-core-surface-split.md`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\*.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\App.tsx`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api\*.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\*.ts`
- `D:\AlphaNexus\app\src\renderer\app\styles\global.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-workbench.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\event-stream.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\capture-overlay.css`

## Invariants to preserve
- Public IPC channel names, preload bridge usage, renderer API method names, and shared payload shapes remain unchanged.
- Mock API and real API keep the same observable behavior and return shapes.
- Session workbench route behavior, state transitions, and async action ordering remain unchanged.
- Local-first behavior remains intact; capture, annotation, and event persistence do not gain AI/network dependencies.
- Existing CSS class names remain valid so current components render the same.

## Migration / compatibility strategy
- Keep the current top-level entry files as compatibility composition roots and move implementation behind them.
- Reuse existing helper logic by extraction instead of rewriting behavior.
- Keep shared mock state in a dedicated module so grouped mock APIs still operate on the same mutable dataset.
- Preserve style import order in `App.tsx` so overrides remain stable after extraction.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Re-inline grouped registrations into `register-ipc-handlers.ts`.
- Re-inline grouped renderer API modules back into `bootstrap/api.ts`.
- Re-inline split workbench modules back into `useSessionWorkbench.ts`.
- Re-merge extracted CSS files into `global.css` and remove the extra imports.
