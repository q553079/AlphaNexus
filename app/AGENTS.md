# AGENTS.md

## App rules
- Keep Electron shell, preload boundary, renderer UI, state wiring, and service adapters separate.
- Do not add persistence, export, or AI provider logic directly into React components.
- Preserve local-first and offline-tolerant behavior for capture, annotation, event creation, and restore.
- Split concerns by domain:
  capture / annotation / context / event / trade / note / ai / review / storage / sync-export
- Do not add new UI logic into old giant files.
- Preserve existing contracts between renderer, preload, and main process unless coordinated changes are intentional.
