# AlphaNexus Session Workbench Evidence Flow Phase 2

## Goal
Turn the Session Workbench center column from a vertical screenshot-card stack into a layered evidence flow: one large primary stage, one filmstrip navigator, and one additive analysis tray that future AI packet building can consume.

## Scope
- Rework `SessionCanvasColumn` into three layers:
  - main stage
  - filmstrip
  - analysis tray
- Keep the current screenshot save / annotation / fullscreen / per-screenshot AI chain working, but stop rendering all screenshots as large stacked cards.
- Add screenshot tray state in the workbench controller so it is not trapped inside one component.
- Let users:
  - switch the primary screenshot from the filmstrip
  - add screenshots to the analysis tray
  - set tray screenshots as the tray primary screenshot
  - remove screenshots from the tray
- Add main-stage display modes:
  - single
  - compare
  - board
- Keep compare mode minimal: primary screenshot plus one secondary screenshot.
- Keep board mode minimal: tray screenshots shown as a grid.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-29-session-workbench-evidence-flow-phase2.md`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionCanvasColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionScreenshotCard.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-workbench.css`
- New renderer-only files under `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\` for stage / filmstrip / tray composition

## Invariants to preserve
- Existing screenshot persistence, annotation save, fullscreen editing, and screenshot-scoped AI interactions remain available.
- No new DB schema, IPC contract, or AI provider change is introduced in this phase.
- The center canvas remains local-first and compatible with existing screenshot/event records.
- AI tray state is renderer-only preparation for the next phase, not a hidden backend write.

## Migration / compatibility strategy
- Reuse current screenshot note / AI / annotation logic by moving it behind the primary stage instead of deleting it.
- Keep screenshot focus derived from the workbench primary selection while adding a separate screenshot tray source list.
- Make stage modes additive UI state only; single-screenshot editing remains the stable fallback path.
- Keep `SessionScreenshotCard` as a compatibility unit where needed, but stop using it as the default list renderer for the whole center column.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run test:regression`

## Rollback notes
- Restore the original stacked screenshot-card rendering inside `SessionCanvasColumn.tsx`.
- Remove the renderer-only screenshot tray state and stage mode switch.
- Keep the previous single selected screenshot behavior if the layered evidence flow causes regressions.
