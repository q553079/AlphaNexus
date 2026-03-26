# AGENTS.md

## Shared rules
- `shared` is for contracts, models, and pure cross-process helpers only.
- Do not pull Electron, database, filesystem, or network dependencies into `shared`.
- Keep IPC payloads, route payloads, and persisted model shapes explicit and stable.
- When a shared type becomes externally observable, carry `schema_version` when applicable.
- Split contracts and models by domain instead of growing catch-all files.
