# AGENTS.md

## Renderer rules
- Keep bootstrap, routing, page composition, feature state, and presentational components separate.
- Do not access database, filesystem, or AI providers directly from renderer code.
- Renderer talks to the host only through preload contracts.
- Split concerns by domain and interaction surface:
  session / trade / review / export / settings / integrations / capture / annotation
- Do not add new UI logic into giant pages or giant global style files when a closer domain module exists.
