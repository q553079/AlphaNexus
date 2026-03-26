# AlphaNexus DeepSeek Real Analysis Increment

## Goal
Replace the Session workbench's mock AI path with a real DeepSeek official API integration for a single-provider market-analysis flow, while persisting AI runs, structured analysis cards, and event-stream entries locally.

## Scope
- Add a real `runAnalysis` contract to the AI IPC surface.
- Add DeepSeek as a first-class provider in local settings and environment resolution.
- Use DeepSeek official chat completions with JSON output for structured market-analysis results.
- Persist completed AI runs, structured analysis cards, AI event entries, and AI content blocks into the local SQLite store.
- Update the Session workbench to call the real AI path and display the latest AI result.
- Keep mock AI support only as a compatibility fallback when no preload bridge exists.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-deepseek-real-analysis.md`
- `D:\AlphaNexus\app\README.md`
- `D:\AlphaNexus\app\src\main\app-shell\env.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\base.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\deepseek.ts`
- `D:\AlphaNexus\app\src\main\ai\registry.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\export\markdown.ts`
- `D:\AlphaNexus\app\src\shared\contracts\analysis.ts`
- `D:\AlphaNexus\app\src\shared\ai\contracts.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\shared\mock-data\session-workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\integrations\provider-catalog.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionWorkbenchHeader.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\HomePage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\TradeDetailPage.tsx`

## Invariants to preserve
- AlphaNexus remains local-first; AI responses are copied into local storage and the app does not depend on cloud memory.
- Core capture and note flows continue to work without AI availability.
- Existing Session workbench layout and page routing remain intact.
- AI output remains structured and auditable instead of freeform-only.
- Missing credentials or provider failures surface explicit errors instead of silent fallback.

## Migration / compatibility strategy
- Add the new AI run contract additively without removing the mock run contract in this increment.
- Keep OpenAI, Anthropic, and Custom HTTP settings intact while adding DeepSeek.
- Persist new AI results using the existing `ai_runs`, `analysis_cards`, `events`, and `content_blocks` tables.
- Use the latest AI card in renderer panels while keeping older cards in the event history.
- Keep mock renderer behavior only when `window.alphaNexus` is unavailable, not when real IPC returns an error.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`
- Manual smoke:
  - set `DEEPSEEK_API_KEY` in the shell
  - open Session workbench
  - trigger Run AI
  - confirm new AI event appears in timeline
  - confirm latest AI card appears in right-side workbench
  - export Markdown and confirm latest AI summary is included

## Rollback notes
- Revert the new AI run IPC contract and renderer call path to the previous mock-only button behavior.
- Revert repository insertion helpers for AI persistence.
- Revert DeepSeek adapter request logic and fall back to mock service behavior.
