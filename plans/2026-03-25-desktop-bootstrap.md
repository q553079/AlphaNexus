# AlphaNexus Desktop Bootstrap Milestone

## Goal
Create a runnable local-first desktop foundation for AlphaNexus using Electron + React + TypeScript + Vite, with SQLite initialization, shared domain contracts, mock event-stream data, a Session workbench screen, and extensible AI/export/screenshot module skeletons.

## Scope
- Initialize `app/` as the desktop application workspace.
- Add Electron main, preload, renderer, and shared contract structure.
- Add SQLite bootstrap and mock seed flow for Session, Trade, Event, Content Block, Screenshot, and AI Analysis concepts.
- Add a light-first renderer shell with routing and a Session workbench page.
- Add screenshot/annotation module scaffolding and local vault-oriented interfaces.
- Add AI provider registry and Markdown export interface scaffolding.
- Create `data/` and `vault/` placeholder directories for local-first storage.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-25-desktop-bootstrap.md`
- `D:\AlphaNexus\app\package.json`
- `D:\AlphaNexus\app\electron.vite.config.ts`
- `D:\AlphaNexus\app\tsconfig.json`
- `D:\AlphaNexus\app\tsconfig.node.json`
- `D:\AlphaNexus\app\tsconfig.web.json`
- `D:\AlphaNexus\app\src\**\*`
- `D:\AlphaNexus\data\*`
- `D:\AlphaNexus\vault\*`

## Invariants to preserve
- AlphaNexus remains local-first; screenshots, annotations, notes, and records stay locally owned.
- Event history remains append-friendly and auditable.
- User-authored notes, AI output, and trade facts remain separate model families.
- Renderer components do not own persistence, export, or AI provider logic.
- Core capture/annotation/event persistence must not require network or AI availability.
- Public shared contracts should remain explicit and versioned where applicable.

## Migration / compatibility strategy
- No existing runtime is being migrated; this is a greenfield bootstrap under the existing repo.
- Preload exposes a narrow, typed IPC surface so later modules can extend contracts without collapsing boundaries.
- SQLite bootstrap seeds mock data only when the database is empty.
- AI and export modules land as interfaces/adapters first so later provider-specific work can extend without breaking renderer contracts.

## Tests to run
- `npm install`
- `npm run typecheck`
- `npm run build`
- Database bootstrap smoke verification through the app service layer or a targeted script if needed

## Rollback notes
- Remove `app/` generated source and package files.
- Remove the new plan entry from `PLANS.md`.
- Remove placeholder `data/` and `vault/` files if bootstrap is reverted entirely.
