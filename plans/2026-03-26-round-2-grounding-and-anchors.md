# AlphaNexus Round 2 Grounding And Anchors

## Goal
Add the second-round knowledge runtime layer: Gemini-backed knowledge ingestion, grounding records, market-anchor memory, and active-anchor context in SessionWorkbench without breaking the local-first workbench flow.

## Scope
- Extend shared contracts for market anchors, grounding hits, and richer knowledge-runtime payloads.
- Add anchor adoption and status updates at the preload / IPC / bootstrap boundary.
- Attach active anchors and recent grounding hits to SessionWorkbench payloads.
- Keep Knowledge Review and Composer working while runtime memory grows.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-round-2-grounding-and-anchors.md`
- `D:\AlphaNexus\app\src\shared\contracts\analysis.ts`
- `D:\AlphaNexus\app\src\shared\contracts\knowledge.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- Worker-owned implementation files under:
  - `D:\AlphaNexus\app\src\main\knowledge\...`
  - `D:\AlphaNexus\app\src\main\grounding\...`
  - `D:\AlphaNexus\app\src\main\db\repositories\knowledge-...`
  - `D:\AlphaNexus\app\src\main\db\repositories\grounding-...`
  - `D:\AlphaNexus\app\src\main\storage\knowledge.ts`
  - `D:\AlphaNexus\app\src\main\domain\knowledge-service.ts`
  - `D:\AlphaNexus\app\src\main\ai\prompt-builders.ts`
  - `D:\AlphaNexus\app\src\renderer\app\features\anchors\...`
  - `D:\AlphaNexus\app\src\renderer\app\features\grounding\...`
  - `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\...`
  - `D:\AlphaNexus\app\src\renderer\app\styles\global.css`

## Invariants to preserve
- Runtime AI consumption remains limited to approved knowledge.
- Draft knowledge, approved knowledge, and runtime grounding records stay distinct.
- Anchor adoption requires explicit user action.
- Capture, annotations, note creation, and trade flow stay usable without AI / Gemini availability.
- Main analysis card structure remains stable while context memory is added as an additive layer.

## Migration / compatibility strategy
- Extend contracts additively with optional or new payload fields instead of mutating existing stable fields.
- Keep the existing `knowledge.ingestSource` path working for manual ingest while adding Gemini-backed extraction inputs.
- Return empty anchor / grounding layers when backend data is unavailable so SessionWorkbench still loads.
- Update bootstrap mocks in the same round so `npm run dev` works without Electron IPC.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`
- Manual regression:
  - Knowledge Review ingest and review flow
  - SessionWorkbench composer shell rendering
  - Anchor adoption / status mutation
  - Grounding hits visible in workbench
  - Approved-only knowledge runtime retrieval

## Rollback notes
- Hide anchor and grounding UI while preserving stored anchors and grounding rows.
- Disable Gemini-backed ingest and fall back to manual ingest without deleting imported source material.
- Keep SessionWorkbench payloads loading with empty context-memory layers if the runtime integration must be reverted.
