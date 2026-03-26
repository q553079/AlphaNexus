# AlphaNexus Round 3 Suggestions And Similarity

## Goal
Add the third-round assistive layer: AI annotation suggestions, stronger composer predictions, anchor review suggestions, and similar-case recall without polluting the core analysis payload or the main SessionWorkbench flow.

## Scope
- Extend shared contracts for annotation suggestions, composer predictions, anchor review suggestions, and similar cases.
- Expose suggestion and retrieval APIs across IPC / preload / bootstrap.
- Keep suggestion content auditable and visually separate from formal annotations, anchors, and analysis cards.
- Attach a lightweight suggestion layer to SessionWorkbench while preserving the existing event-driven workbench flow.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-round-3-suggestions-and-similarity.md`
- `D:\AlphaNexus\app\src\shared\contracts\analysis.ts`
- `D:\AlphaNexus\app\src\shared\contracts\knowledge.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- Worker-owned implementation files under:
  - `D:\AlphaNexus\app\src\main\ai\...`
  - `D:\AlphaNexus\app\src\main\knowledge\...`
  - `D:\AlphaNexus\app\src\main\grounding\...`
  - `D:\AlphaNexus\app\src\main\db\repositories\suggestion-...`
  - `D:\AlphaNexus\app\src\main\db\repositories\anchor-...`
  - `D:\AlphaNexus\app\src\renderer\app\features\composer\...`
  - `D:\AlphaNexus\app\src\renderer\app\features\suggestions\...`
  - `D:\AlphaNexus\app\src\renderer\app\features\anchors\...`
  - `D:\AlphaNexus\app\src\renderer\app\features\grounding\...`
  - `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\...`

## Invariants to preserve
- AI suggestions never overwrite formal user annotations, notes, or anchors.
- Only user-confirmed actions can turn a suggestion into formal annotation or anchor state.
- Similar-case recall remains local-first and bounded in volume.
- The existing AI analysis card contract stays stable; suggestions are additive only.
- Runtime knowledge consumption remains approved-only.

## Migration / compatibility strategy
- Extend contracts additively and keep existing workbench payloads valid when suggestion data is absent.
- Allow empty suggestion arrays and empty similar-case payloads so the workbench can load before all backend pieces are present.
- Keep mock bootstrap data aligned with the new APIs so browser-only dev remains usable.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`
- Manual regression:
  - SessionWorkbench loads without suggestion data
  - AI analysis output remains stable
  - Suggestion actions do not overwrite formal annotations
  - Similar cases stay small and readable

## Rollback notes
- Hide suggestion UI panels and similar-case sections while preserving stored suggestion audit records.
- Disable anchor-review suggestions without affecting explicit user-managed anchor status.
- Fall back to the round-2 composer shell if prediction or suggestion layers destabilize the workbench.
