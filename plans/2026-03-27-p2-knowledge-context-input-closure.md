# AlphaNexus P2 Knowledge And Context Input Closure

## Goal
Turn the current knowledge/composer/annotation skeleton into a real P2 chain: ingest source -> fragment -> draft cards -> reviewed approved cards -> runtime retrieval -> composer suggestions -> semantic annotations -> candidate annotation keep/discard.

## Scope
- Harden the knowledge review pipeline so draft and approved states stay explicit and auditable.
- Add the minimum runtime retrieval shape needed by SessionWorkbench and AI prompt assembly.
- Persist composer suggestion acceptances so chips/templates are suggestions with audit, not UI-only insertion.
- Extend formal annotations with semantic fields and an explicit memory-candidate flag.
- Render AI annotation suggestions as a separate candidate layer and keep keep/discard behavior isolated from formal annotations.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-27-p2-knowledge-context-input-closure.md`
- `D:\AlphaNexus\app\src\main\db\migrations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\knowledge-mappers.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\knowledge-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\knowledge-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\knowledge-repository.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mappers.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\domain\knowledge-service.ts`
- `D:\AlphaNexus\app\src\main\domain\suggestion-service.ts`
- `D:\AlphaNexus\app\src\main\storage\knowledge.ts`
- `D:\AlphaNexus\app\src\main\storage\suggestions.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\shared.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-knowledge-ipc.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-workbench-ipc.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\shared\contracts\knowledge.ts`
- `D:\AlphaNexus\app\src\shared\contracts\content.ts`
- `D:\AlphaNexus\app\src\shared\contracts\analysis.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\shared\capture\contracts.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\knowledge\api-adapter.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\knowledge\types.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\knowledge\useKnowledgeReviewShell.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\knowledge\KnowledgeSourceIngestCard.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\knowledge\KnowledgeDraftCards.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\knowledge\KnowledgeApprovedCards.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\composer\types.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\composer\ComposerSuggestionShell.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\composer\SessionWorkbenchComposerShell.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\composer\workbench-adapter.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\annotation\annotation-types.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\annotation\annotation-utils.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\capture\CaptureEditorSurface.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\capture\CaptureOverlayComposer.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionCanvasColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkspaceColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\hooks\useSessionWorkbenchActions.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\modules\session-workbench-mappers.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\modules\session-workbench-selection.ts`
- `D:\AlphaNexus\app\scripts\regression-checks.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\knowledge-regression.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\preload-contract-regression.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\helpers.mjs`
- One new regression test for composer/annotation semantic flow

## Invariants to preserve
- Session, capture, annotation save, note save, and event creation remain local-first and must not block on runtime retrieval or network.
- Runtime retrieval only reads approved knowledge cards.
- Draft knowledge cards never appear in AI prompt context, composer runtime context, or SessionWorkbench runtime chips.
- AI candidate annotations remain separate from formal annotations until the user explicitly keeps or merges them.
- Renderer stays a consumer of preload contracts; DB and retrieval logic stay in main.

## Migration / compatibility strategy
- Use additive schema changes only:
  - extend `annotations` with semantic metadata and memory-candidate fields
  - add a small composer acceptance audit table for accepted suggestion records
- Backfill legacy annotations so old rows remain readable:
  - `title = label`
  - `semantic_type = NULL`
  - `note_md = text`
  - `add_to_memory = 0`
- Keep existing knowledge tables and statuses; tighten review handling and public contract mapping without renaming current table names or public payload fields.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Revert the additive annotation/composer schema changes and remove new IPC methods.
- Fall back to the previous knowledge review UI and non-persisted composer insertion behavior.
- Remove candidate overlay rendering while keeping the existing suggestion list and action audit behavior.
