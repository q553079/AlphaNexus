# AlphaNexus Session Workbench AI Packet Composer Phase 3

## Goal
Upgrade screenshot-triggered AI interaction from a direct "send this screenshot" button into a user-visible packet composer plus a large bottom AI dock, so users can control exactly what evidence and background context the AI sees before sending.

## Scope
- Keep the existing fast-send path for minimal interruption.
- Add an edit-before-send AI packet composer, preferably as a side drawer.
- Expand AI analysis context to carry:
  - primary screenshot
  - background screenshots
  - image region mode
  - background toggles
  - editable background draft
  - packet preview summary
- Reuse the current analysis call chain instead of inventing a parallel AI transport.
- Upgrade the bottom AI dock into a usable multi-turn workspace with:
  - peek / medium / large
  - summary / full / packet views
  - visible context chips
  - larger input area for follow-up questions

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-29-session-workbench-ai-packet-composer-phase3.md`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\useSessionWorkbench.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\hooks\useSessionWorkbenchActions.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionScreenshotCard.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\shared\ai\contracts.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- `D:\AlphaNexus\app\src\main\ai\prompt-builders.ts`
- New renderer-only AI packet composer / AI dock files under `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\`

## Invariants to preserve
- Existing single-screenshot quick-send remains available.
- No new top-level page is added; the workbench remains the host surface.
- Existing AI provider routing and persistence chain stays intact.
- Users can always see what evidence is being sent; AI remains assistive, not the fact source.

## Migration / compatibility strategy
- Keep current `analysis_context` additive and backwards compatible.
- Route both quick-send and edit-before-send through the same preferred-provider analysis action.
- Build the editable background draft from existing session note, selected events, trade facts, and prior AI summaries, then let users change it before send.
- Centralize packet state in the workbench hook so screenshot modules and the bottom AI dock consume the same packet source of truth.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run test:regression`

## Rollback notes
- Restore the current "让 AI 参考这张图" direct action as the only screenshot-send entry.
- Remove the additive packet fields from `analysis_context` if they prove too unstable.
- Collapse the bottom AI dock back to the smaller placeholder state if the large chat surface introduces regressions.
