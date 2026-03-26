# AGENTS.md

## Test rules
- Prefer contract/domain/integration/offline-degraded layering.
- Do not dump all new tests into a single giant file.
- When changing renderer-main, preload, or route contracts, add contract tests.
- When changing capture, annotation, event, trade, or review behavior, add domain tests.
- When changing storage, export, aggregation, or rebuild behavior, add integration tests.
- When changing local-first, offline, restore, or AI-unavailable behavior, add degraded-mode tests.
