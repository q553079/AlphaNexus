# AGENTS.md

## Contract rules
- Keep contract names and payload fields stable.
- Do not silently rename IPC channels, route shapes, content block types, event types, or integration keys.
- Contract files should stay domain-scoped:
  capture / event / trade / session / analysis / export / integrations
- When a contract changes, update the corresponding tests and migration notes.
- AI provider contract changes must keep provider ids, auth semantics, and config field meanings stable unless an explicit migration is documented.
- Adding a new China provider should extend shared contracts centrally instead of introducing ad-hoc renderer-local config shapes.
