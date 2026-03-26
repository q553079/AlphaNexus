# Anchor Persistence Refactor

## Goal
Replace temporary IPC-built anchor objects with real persisted anchor entities, while keeping the current renderer contract stable and preserving local-first behavior.

## Scope
- Add a dedicated anchor table and a lightweight anchor status history audit table.
- Add repository and domain functions for create, get, list with filters, and update status.
- Rewire anchor IPC handlers to use real persistence.
- Change runtime anchor summaries to use persisted anchors as the primary source and grounding only as attached usage statistics.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-anchor-persistence.md`
- `D:\AlphaNexus\app\src\main\db\migrations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\anchor-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\anchor-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\anchor-repository.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\anchor-mappers.ts`
- `D:\AlphaNexus\app\src\main\domain\knowledge-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\shared\contracts\knowledge.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- `D:\AlphaNexus\app\src\main\ai\prompt-builders.ts`

## Invariants to preserve
- Local-first storage remains the source of truth.
- Approved knowledge remains the only runtime knowledge source.
- Anchors remain separate from annotations, suggestions, and draft knowledge.
- Capture, annotation, and event creation must remain usable without AI.
- Existing renderer-facing anchor payload shape stays compatible unless an additive field is clearly needed.

## Migration / compatibility strategy
- Add the new anchor tables in an additive migration.
- Keep `knowledge_groundings.anchor_id` as a foreign reference target by convention; do not remove or reinterpret existing grounding data.
- Default `get-active-anchors` to status `active` when no explicit status filter is supplied, matching current renderer expectations.
- Keep runtime summary outputs backward-compatible by continuing to expose the current summary fields while filling them from the persisted anchor entity.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`

## Rollback notes
- If the new anchor persistence path causes instability, revert IPC handlers to the prior temporary-object path while keeping the new tables unused.
- The migration is additive; rollback can ignore the new tables without affecting prior data flows.
