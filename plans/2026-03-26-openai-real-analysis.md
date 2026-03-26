# AlphaNexus OpenAI Real Analysis Increment

## Goal
Replace the Session workbench's mock AI path with a real OpenAI Responses API integration for a single-provider market-analysis flow, while persisting AI runs, structured analysis cards, and event-stream entries locally.

## Scope
- Add a real `runAnalysis` contract to the AI IPC surface.
- Use OpenAI Responses API with image inputs and structured JSON output.
- Persist completed AI runs, analysis cards, AI event entries, and AI content blocks into the local SQLite store.
- Update the Session workbench to call the real AI path and display the latest AI result.
- Keep mock AI support available only as a compatibility fallback when no preload bridge exists.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-openai-real-analysis.md`
- `D:\AlphaNexus\app\src\shared\ai\contracts.ts`
- `D:\AlphaNexus\app\src\shared\contracts\analysis.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\base.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\openai.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- `D:\AlphaNexus\app\src\main\ai\registry.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\export\markdown.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`

## Invariants to preserve
- AlphaNexus remains local-first; AI responses are copied into local storage and the app does not depend on cloud memory.
- Core capture and note flows continue to work without AI availability.
- Existing Session workbench page structure remains intact.
- AI output remains structured and auditable instead of freeform-only.
- If OpenAI credentials are missing or the request fails, the app surfaces an error instead of silently inventing analysis.

## Migration / compatibility strategy
- Add the new AI run contract additively without removing the mock run contract in this increment.
- Persist new AI results using the existing `ai_runs`, `analysis_cards`, `events`, and `content_blocks` tables.
- Use the latest AI card in renderer panels while keeping older cards in the event history.
- Keep renderer fallback mock behavior only when `window.alphaNexus` is unavailable, not when real local IPC returns an error.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run dev`
- Manual smoke:
  - run Session workbench with `OPENAI_API_KEY`
  - trigger Run AI
  - confirm new AI event appears in timeline
  - confirm latest AI card appears in right-side workbench
  - export Markdown and confirm latest AI summary is included

## Rollback notes
- Revert the new AI run IPC contract and renderer call path to the previous mock-only button behavior.
- Revert repository insertion helpers for AI persistence.
- Revert OpenAI adapter request logic and return to mock service behavior.
