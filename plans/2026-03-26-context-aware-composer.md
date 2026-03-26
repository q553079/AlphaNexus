# AlphaNexus Context-Aware Composer

## Goal
Add a context-aware composer to SessionWorkbench that provides structured note suggestions, AI candidate annotations, and user-confirmed market-anchor memory while preserving user control and auditability.

## Scope
- Add composer suggestion types: phrase, template, and completion.
- Add AI annotation suggestions with retain, merge, and discard flows.
- Add market-anchor memory and carry-forward behavior.
- Bind runtime suggestions to approved knowledge cards and current workbench context.

## Files expected to change
- `D:\AlphaNexus\docs\AlphaNexus-Design.md`
- `D:\AlphaNexus\docs\AlphaNexus-Context-Aware-Composer-Construction.md`
- `D:\AlphaNexus\docs\AlphaNexus-PostKickoff-Implementation-Plan.md`
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-context-aware-composer.md`
- Future implementation is expected to touch:
  - `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\...`
  - `D:\AlphaNexus\app\src\main\ai\...`
  - `D:\AlphaNexus\app\src\main\domain\...`
  - `D:\AlphaNexus\app\src\main\storage\...`
  - `D:\AlphaNexus\app\src\shared\contracts\...`

## Invariants to preserve
- AI suggestions never overwrite the user's authored note by default.
- Only user-confirmed regions can become persistent memory anchors.
- Composer suggestions remain lightweight and do not block core capture or note creation.
- Runtime suggestion quality depends on approved knowledge, not draft knowledge.

## Migration / compatibility strategy
- Add composer capabilities incrementally.
- Start with rules plus approved-knowledge suggestions before AI-generated completion.
- Keep AI suggestion layers visually distinct from user annotations.

## Tests to run
- Document consistency check across design, construction, and plan docs.
- Future implementation should cover:
  - suggestion generation by context type
  - accept/reject flows
  - anchor carry-forward logic
  - AI suggestion layer separation

## Rollback notes
- Hide the composer suggestion layer and anchor memory while preserving existing notes and annotations.
- Revert AI suggestion interactions without affecting the base capture and workbench flow.
