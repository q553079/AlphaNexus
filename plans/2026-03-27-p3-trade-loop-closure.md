# AlphaNexus P3 Trade Loop Closure

## Goal
Close the real trade thread from open to exit so AlphaNexus behaves like a trading review tool instead of a generic event notebook.

## Scope
- Add the missing `cancel` trade lifecycle branch with real persistence and event history.
- Separate trade facts, intraday AI analysis, and trade-review AI outputs in trade detail queries and UI.
- Expose a real trade-review AI entrypoint bound to one trade and visible in `TradeDetail`.
- Harden exit capture guidance so exit screenshots prefer the current open trade and degrade clearly when none exists.
- Add regression coverage for lifecycle, exit guidance, trade detail assembly, and trade-review AI writeback.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-27-p3-trade-loop-closure.md`
- `D:\AlphaNexus\docs\AlphaNexus-PostKickoff-Implementation-Plan.md`
- `D:\AlphaNexus\app\src\shared\contracts\trade.ts`
- `D:\AlphaNexus\app\src\shared\contracts\event.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench-trade.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-trade-mutations.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-repository.ts`
- `D:\AlphaNexus\app\src\main\storage\workbench.ts`
- `D:\AlphaNexus\app\src\main\domain\workbench-service.ts`
- `D:\AlphaNexus\app\src\main\review\review-service.ts`
- `D:\AlphaNexus\app\src\main\ai\prompt-builders.ts`
- `D:\AlphaNexus\app\src\main\app-shell\ipc\register-workbench-ipc.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\TradeDetailPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\trade\*.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\hooks\useSessionWorkbenchTradeActions.ts`
- `D:\AlphaNexus\app\scripts\regression\workbench-regression.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\trade-detail-regression.test.mjs`
- `D:\AlphaNexus\app\scripts\regression\capture-overlay-regression.test.mjs`
- one new trade-review regression if needed

## Invariants to preserve
- Trade facts remain user/system facts; AI outputs are analysis only.
- Exit screenshot capture remains local-first and must not block on AI.
- Renderer continues to consume preload APIs only.
- Trade detail reads real DB-backed relationships instead of reconstructing them in the page.
- Existing open/add/reduce/close flows remain backward-compatible.

## Migration / compatibility strategy
- Use additive contract expansion:
  - extend trade status with `canceled`
  - extend event type with `trade_cancel`
  - extend trade detail payload with explicit AI review groupings
- No destructive table rewrite is required because trade and event status/type columns are string-backed.
- Existing `closed` and `open` trades remain valid; old trade detail payloads are mapped into the new grouped fields.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Revert the added cancel branch and trade-review UI/API entrypoint.
- Keep existing open/add/reduce/close and trade detail behavior.
- Remove any new grouped trade-review fields from trade detail payload mapping if needed.
