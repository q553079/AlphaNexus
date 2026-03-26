# code_review.md

## Must flag immediately
- AI logic becoming the sole source of truth for trade facts or event history
- Capture, annotation, or event creation blocked on AI or network availability
- Contract/schema/event-type rename without migration note
- Renderer/UI code taking ownership of persistence or provider logic directly
- Giant-file growth without split plan
- Local-first storage assumptions weakened without explicit approval
- First-class China provider support implemented as OpenAI-only assumptions or hidden behind generic `custom-http`
- Provider auth, base URL, or model routing logic duplicated across renderer, preload, and main instead of staying centralized

## Strong warnings
- Mixed domain DTO/model files with unrelated objects
- New renderer-main or preload contracts without explicit tests
- Event stream logic mixed with review or aggregation behavior in the same module
- AI output stored without separating raw response, summary, and structured fields
- Trade facts, user notes, and AI opinions collapsed into one payload
- Provider enum additions without contract, doc, and migration notes
- Provider capability differences handled by ad-hoc `if provider === ...` chains spread across multiple layers

## Preferred outcomes
- Smaller modules with explicit responsibilities
- Stable contracts with explicit `schema_version` where applicable
- Tests layered as contract, domain, integration, offline/degraded
- Minimal diffs that preserve local-first and auditability guarantees
