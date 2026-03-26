# AlphaNexus Event Stream Design-Near Skeleton

## Goal
Upgrade the Session event stream from a flat filtered log into a stronger product skeleton with collapse, trade focus, strong-signal emphasis, and more direct trade-thread navigation, without changing persistence contracts unless strictly necessary.

## Scope
- Rework Session event stream presentation in renderer to feel grouped and navigable rather than log-like.
- Add collapsible handling for AI events, note/review events, and low-attention events outside the current focus trade.
- Add a trade focus mode that scopes the event stream to one trade or all trades.
- Strengthen event-to-trade-thread navigation and explicit relationship labels for screenshot / AI / trade / review linkage.
- Keep event click -> screenshot / workspace selection linkage intact.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-event-stream-design-near.md`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionEventColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\components\EventStreamCard.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\event-stream.css`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-event-stream.css`

## Invariants to preserve
- No schema, IPC, or public payload rename.
- Existing event selection must still drive screenshot linkage and right-side workspace context.
- Existing trade detail routes and session routes stay stable.
- Existing filters from Prompt 5 remain available or improve, not regress.

## Migration / compatibility strategy
- Prefer deriving all new grouping / focus / relation metadata in renderer from current payloads.
- Only add contract fields if renderer derivation proves insufficient.
- Keep event stream state local to the workbench page/controller so no persistence migration is required.

## Tests to run
- `npm run typecheck`
- `npm run build`
- Manual smoke: filter, collapse, trade focus, event-to-trade jump, selection linkage

## Rollback notes
- Remove the plan entry from `PLANS.md`.
- Revert the event stream UI/state/style changes to return to the Prompt 5 MVP list view.
