# AlphaNexus Workbench Repository Split

## Goal
Split `src/main/db/repositories/workbench-repository.ts` into smaller repository modules so query mapping, mock seed insertion, and content-block mutations stop accumulating inside one mixed-responsibility file.

## Scope
- Extract row mappers and shared repository helpers.
- Extract seed insertion logic.
- Extract read/query logic for session, trade, and period payloads.
- Extract content-block and screenshot mutation helpers.
- Keep the public functions currently used by `storage/workbench.ts` and `storage/database.ts` stable.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-workbench-repository-split.md`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mappers.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-seed.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-utils.ts`

## Invariants to preserve
- SQLite schema and seeded data stay unchanged.
- Session, Trade, Period, Screenshot, Content Block, and AI payload contracts remain stable.
- Existing imports from `storage/database.ts` and `storage/workbench.ts` continue to work.
- Local-first storage behavior and mock seeding behavior remain unchanged.

## Migration / compatibility strategy
- Keep `workbench-repository.ts` as a thin compatibility facade that re-exports the same public functions.
- Move logic behind that facade into smaller domain-focused modules without renaming the exported repository API.
- Do not change preload, renderer, or IPC contracts in this refactor.

## Tests to run
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Collapse the extracted repository modules back into `workbench-repository.ts`.
- Restore the prior re-export surface if any import path breakage appears.
