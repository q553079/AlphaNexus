# AlphaNexus Round 6 Training And Profile

## Goal
Add a reviewable learning loop: user profile summaries, training insights, transparent ranking reasons, and memory-update proposals that stay human-audited and reversible.

## Scope
- Extend shared contracts for profile metrics, training insights, ranking explanations, and memory proposals.
- Add lightweight services that derive long-term patterns from evaluation, feedback, rules, and setup history.
- Surface learning outputs in PeriodReview and Settings AI without turning AlphaNexus into a black-box recommender.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-round-6-training-and-profile.md`
- `D:\AlphaNexus\app\src\shared\contracts\evaluation.ts`
- `D:\AlphaNexus\app\src\shared\contracts\knowledge.ts`
- `D:\AlphaNexus\app\src\shared\contracts\workbench.ts`
- `D:\AlphaNexus\app\src\preload\index.ts`
- `D:\AlphaNexus\app\src\main\app-shell\register-ipc-handlers.ts`
- `D:\AlphaNexus\app\src\renderer\app\bootstrap\api.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\PeriodReviewPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\pages\SettingsAiPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\global.css`
- New local training/profile/memory services under `D:\AlphaNexus\app\src\main\training\...`, `...profile\...`, `...memory\...`

## Invariants to preserve
- Learning outputs are suggestions, not auto-edits to formal knowledge or rules.
- Ranking reasons stay concise and inspectable.
- Memory updates remain reviewable and reversible.
- Profile summaries are evidence-backed, not personality-test fluff.

## Migration / compatibility strategy
- Add reviewable proposal files and derived payloads without altering trade/session persistence.
- Keep all new sections optional with explicit empty states.
- Reuse round-4/round-5 outputs as inputs instead of duplicating logic.

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run rebuild:native`
- `npm run dev`

## Rollback notes
- Hide profile/training/memory sections while preserving evaluation and feedback data.
- Ignore pending memory proposals if the review UX needs to be deferred.
