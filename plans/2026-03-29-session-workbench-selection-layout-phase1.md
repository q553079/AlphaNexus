# AlphaNexus Session Workbench Selection And Layout Phase 1

## Goal
Upgrade Session Workbench away from a single `selectedEvent` mental model into a compatible multi-event-ready shell: three-zone top layout, bottom AI dock skeleton, and additive event selection state that still preserves the current single-event workflow.

## Scope
- Keep `SessionWorkbenchPage` as the existing page entry and make it compose a clearer layout:
  - left unified timeline
  - center screenshot stage
  - right stable record area
  - bottom AI dock skeleton
- Add renderer-side event selection state with:
  - `single`
  - `range`
  - `pinned`
- Preserve `selectedEvent` behavior by deriving it from `primaryEventId`.
- Add Shift range select, pin/unpin for non-contiguous events, and clear-selection support.
- Add a lightweight multi-select toolbar in the left timeline:
  - add to AI tray
  - save as case placeholder
  - clear selection
- Add renderer-only `AnalysisTrayState` and `AiDockState` scaffolding without implementing the full AI dispatcher or Case persistence yet.
- Add Session / Events timeline presentation toggle, where Session mode is still the same event stream grouped into phases instead of becoming a separate world.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-29-session-workbench-selection-layout-phase1.md`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionEventColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\session-workbench-types.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\modules\session-workbench-selection.ts`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-workbench.css`
- New renderer-only files under `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\` if needed for dock or selection helpers

## Invariants to preserve
- Electron + React + SQLite main architecture stays unchanged.
- Session workbench remains the same route/page; no new top-level page is added.
- Existing open-session, single-event focus, screenshot viewing, realtime note writing, and trade action flows keep working.
- AI remains assistive and auditable; no renderer change makes it the only fact source.
- Existing workbench API, preload, IPC, and DB contracts remain unchanged for this phase.

## Migration / compatibility strategy
- Keep selection changes renderer-local for this phase.
- Introduce additive selection state and compatibility setters so existing action hooks can still target a single selected event.
- Continue deriving `selectedEvent` from `primaryEventId` and keep screenshot focus behavior tied to the primary event when relevant.
- Reuse current canvas and record components instead of rewriting the whole workbench.
- Treat AI tray and AI dock as UI scaffolding only; full AI packet building and Case persistence stay for the next phase.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run test:regression`

## Rollback notes
- Revert to the prior `selectedEventId`-only state in `useSessionWorkbench.ts`.
- Remove the bottom AI dock composition from `SessionWorkbenchPage.tsx`.
- Restore the original left-column event list without Session / Events mode toggle and multi-select toolbar if the new selection model introduces instability.
