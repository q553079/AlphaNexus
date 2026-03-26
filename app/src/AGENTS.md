# AGENTS.md

## Source rules
- Keep `main`, `preload`, `renderer`, and `shared` boundaries explicit.
- Business logic should live in the closest domain module, not in bootstrap or entry files.
- Keep local-first, offline-tolerant behavior intact for capture, annotation, event creation, storage, and export.
- Shared contracts and shared models must remain stable and versioned when externally exposed.
- If a source file grows past the agreed limit, split it before adding more logic.
