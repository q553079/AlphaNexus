# AGENTS.md

## Preload rules
- Preload is a narrow bridge only.
- Do not add persistence, AI provider, filesystem, or business-domain logic here.
- Expose stable, explicit APIs from preload to renderer.
- Keep preload payloads aligned with shared contracts.
- Any preload contract change must be coordinated with renderer and main-process tests.
