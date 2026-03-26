# AGENTS.md

## Model rules
- Keep schema names stable.
- Every externally returned model should carry `schema_version` when applicable.
- Keep trade facts, user-authored notes, AI summaries, and AI structured outputs as distinct model shapes.
- Split model files by domain when type density grows.
- Do not mix unrelated DTOs or persisted records in one file.
- Do not silently delete or rename externally visible fields.
