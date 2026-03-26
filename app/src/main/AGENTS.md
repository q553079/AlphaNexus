# AGENTS.md

## Main-process rules
- Main owns storage, filesystem access, AI provider calls, export, and IPC handler registration.
- Do not move renderer presentation logic into main-process modules.
- Keep AI provider adapters, prompt building, persistence, and IPC orchestration separate.
- Preserve local-first behavior: capture, event persistence, and export must not require a live network.
- Treat IPC handlers as contract boundaries; keep them thin and delegate business logic to domain services.
- Treat official China LLM providers as first-class integrations, not as generic fallback endpoints.
- Keep provider registry, auth strategy, model routing, and persistence of provider settings separate.
- Do not force all providers into OpenAI-only assumptions; keep room for OpenAI-compatible, endpoint-based, signed cloud API, and routed-platform integrations.
