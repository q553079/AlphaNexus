# AlphaNexus Round 1 To 6 Audit

## Goal
Audit the current repository against the user's round-1 through round-6 prompts, then close the most material implementation gaps without destabilizing the local-first workbench.

## Scope
- Review the actual repository state across contracts, IPC/preload, backend services, bootstrap mocks, routes, and pages.
- Mark each round as completed, MVP-completed, or partially complete.
- Close the most concrete gap found during audit: explicit rule-engine rollup visibility for round 5.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-round-1-to-6-audit.md`
- `D:\AlphaNexus\app\src\shared\contracts\evaluation.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\main\rules\rules-service.ts`
- `D:\AlphaNexus\app\src\main\feedback\feedback-service.ts`
- `D:\AlphaNexus\app\src\main\review\review-service.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\main\db\repositories\workbench-queries.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\features\evaluation\RuleRollupPanel.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\PeriodReviewPage.tsx`

## Invariants to preserve
- Approved knowledge remains the only runtime knowledge source.
- Draft knowledge, approved knowledge, suggestions, anchors, and memory proposals stay distinct.
- AI suggestions and learning outputs remain additive; they do not overwrite user records.
- Local-first behavior stays intact; no new production dependency is introduced.
- The core event/session/trade workflow remains primary and usable without AI.

## Migration / compatibility strategy
- Keep contract changes additive.
- Keep new round-5 rule rollup sections empty-safe so older data continues to load.
- Use a lightweight local rules config file path for future enable/disable support instead of adding a new database migration.

## Audit Summary

### Round 1
- Status: completed baseline
- Confirmed:
  - local-first capture / annotation / event / trade / AI workbench flow exists
  - routes, launcher, workbench, AI settings, export all load
  - build/typecheck/dev path is working
- Note:
  - round 1 was already present before this implementation pass; current work preserved and extended it rather than rebuilding it from zero

### Round 2
- Status: completed MVP
- Confirmed:
  - knowledge ingest, fragments, draft cards, approved cards
  - runtime approved knowledge retrieval
  - grounding payloads
  - market anchors and active-anchor context
  - approved knowledge + active anchors injected into runtime prompt glue
- Remaining softness:
  - anchor summaries are still lightweight derivations rather than a richer dedicated anchor domain model

### Round 3
- Status: completed MVP, one notable partial
- Confirmed:
  - annotation suggestions
  - composer phrase/template/completion suggestions
  - anchor review suggestions
  - similar-case recall
  - SessionWorkbench now reads real suggestion APIs instead of local-only derived filler
- Remaining partial:
  - `applySuggestionAction` is still a lightweight confirmation/audit boundary, not a full persisted merge-to-formal-annotation pipeline

### Round 4
- Status: completed MVP
- Confirmed:
  - AI vs Human trade evaluation
  - calibration buckets
  - period review rollups
  - TradeDetail and PeriodReview wired to evaluation payloads
- Remaining softness:
  - calibration is intentionally lightweight bucket-based derivation, not a heavier statistics layer

### Round 5
- Status: completed MVP after audit fix
- Confirmed:
  - feedback items
  - discipline scoring
  - setup leaderboard
  - trade-level rule hits
  - period-level frequent rule-hit rollup now surfaced explicitly
- Remaining partial:
  - rules are transparent built-ins with local enable/disable path prepared, but there is not yet a full user-authored rule editing workflow

### Round 6
- Status: completed MVP
- Confirmed:
  - user profile snapshot
  - training insights
  - ranking explanations
  - memory proposal review flow
  - Settings AI and PeriodReview surfaces connected
- Remaining softness:
  - profile/training/memory outputs are derived lightweight services and proposal files, not a fully persisted long-term learning subsystem

## Highest-priority remaining gaps after this audit
1. Suggestion action persistence is still partial.
   - `keep / merge / discard` is wired and auditable, but not yet a full formal-annotation merge pipeline.
2. User-authored rules are still partial.
   - The current rule engine is transparent and local-first, but still built around built-in rules plus future config toggles rather than a complete rule editor.
3. Long-term learning persistence is still lightweight.
   - Profile, training, and memory proposals are usable MVP outputs, but not yet a deeper persisted evolution system.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`

## Rollback notes
- Remove period-level rule rollup display while keeping trade-level rule hits if the new review section proves noisy.
- Keep all audit results as documentation even if some follow-up implementation is reverted.
