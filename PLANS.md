# PLANS.md

Use this file as an index for significant refactor or delivery plans.

## When to add a plan
Create a plan before changes such as:
- giant-file splits
- schema or contract changes
- storage or export refactors
- route, IPC, or preload reorganizations
- local-first or offline behavior changes
- event stream or aggregation rebuild changes

## Minimum plan sections
- Goal
- Scope
- Files expected to change
- Invariants to preserve
- Migration / compatibility strategy
- Tests to run
- Rollback notes

## Rule
Implementation should follow the approved plan instead of improvising broad rewrites.

## Active plans
- 2026-03-25: [Desktop bootstrap milestone](plans/2026-03-25-desktop-bootstrap.md)
- 2026-03-26: [Session workbench real-data increment](plans/2026-03-26-session-workbench-real-data.md)
- 2026-03-26: [OpenAI real analysis increment](plans/2026-03-26-openai-real-analysis.md)
- 2026-03-26: [DeepSeek real analysis increment](plans/2026-03-26-deepseek-real-analysis.md)
- 2026-03-26: [Knowledge base pipeline](plans/2026-03-26-knowledge-base-pipeline.md)
- 2026-03-26: [Context-aware composer](plans/2026-03-26-context-aware-composer.md)
- 2026-03-26: [Round 2 grounding and anchors](plans/2026-03-26-round-2-grounding-and-anchors.md)
- 2026-03-26: [Round 3 suggestions and similarity](plans/2026-03-26-round-3-suggestions-and-similarity.md)
- 2026-03-26: [Round 4 evaluation and calibration](plans/2026-03-26-round-4-evaluation-and-calibration.md)
- 2026-03-26: [Round 5 feedback and rules](plans/2026-03-26-round-5-feedback-and-rules.md)
- 2026-03-26: [Round 6 training and profile](plans/2026-03-26-round-6-training-and-profile.md)
- 2026-03-26: [Round 1 to 6 audit](plans/2026-03-26-round-1-to-6-audit.md)
- 2026-03-26: [Workbench repository split](plans/2026-03-26-workbench-repository-split.md)
- 2026-03-26: [Session workbench page split](plans/2026-03-26-session-workbench-page-split.md)
- 2026-03-26: [Snip capture shortcuts](plans/2026-03-26-snip-capture-shortcuts.md)
- 2026-03-26: [Session launcher active session](plans/2026-03-26-session-launcher-active-session.md)
- 2026-03-26: [Anchor persistence refactor](plans/2026-03-26-anchor-persistence.md)
- 2026-03-26: [Analysis card trade granularity](plans/2026-03-26-analysis-card-trade-granularity.md)
