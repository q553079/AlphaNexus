# AlphaNexus Session Workbench OneNote-First Layout

## Goal
Shift the Session Workbench from a three-column "content + AI sidebar" tool layout toward a OneNote-like reading and writing flow: left-side event navigation, right-side page content, with AI and trade actions embedded into the page instead of owning a separate side panel.

## Scope
- Collapse the workbench layout from three columns into a left navigation rail plus a main content page.
- Reduce the left column to event-flow navigation instead of filter/control panels.
- Move record, AI, and trade controls into the main page flow so the page reads top-to-bottom like one notebook page.
- Add a note-driven story index so the page can jump to specific note blocks in current order.
- Move screenshot annotation controls into a fullscreen editing layer instead of leaving them scattered on the page.
- Let an event image carry its own note/description block, attached to the image event itself.
- Split each selected event image into a notebook-style two-column area: left-side note, right-side AI reply, with adopt-into-note actions.
- Extend annotation shapes and editing affordances without changing local-first storage assumptions.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-28-session-workbench-onenote-layout.md`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionEventColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionCanvasColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionScreenshotCard.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkspaceColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionRealtimeViewPanel.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\annotation\annotation-geometry.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\capture\CaptureEditorSurface.tsx`
- `D:\AlphaNexus\app\src\shared\contracts\content.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-note-mutations.ts`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-workbench.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-event-stream.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\capture-overlay.css`

## Invariants to preserve
- Session workbench remains local-first; no write path moves into a new renderer data layer.
- Existing note save, screenshot save, AI run, trade lifecycle, delete/restore, and export actions keep the same behavior.
- DB schema remains unchanged; contract changes stay additive.
- AI stays assistive and auditable, not the source of truth for trade facts or event history.

## Migration / compatibility strategy
- Recompose existing renderer components instead of introducing a new state store.
- Keep existing component props stable where possible and only change their placement/composition.
- Reuse current feature components for notes, AI, and trade controls, but render them as inline page sections rather than a permanent side column.
- Attach image notes to existing screenshot events via additive note-block contract support instead of inventing a new table or fake event layer.
- Keep annotation persistence in the existing screenshot annotation JSON + annotated asset path; richer tools must serialize back through the same local-first path.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run test:regression`

## Rollback notes
- Restore the original three-column grid in `SessionWorkbenchPage.tsx` and `session-workbench.css`.
- Move `SessionWorkspaceColumn` back to the right-hand column.
- Restore the previous left-column control block if the simplified event navigation makes basic workbench actions unusable.
