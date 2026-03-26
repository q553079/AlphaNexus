# AlphaNexus Desktop App

Electron + React + TypeScript + Vite desktop bootstrap for the local-first AlphaNexus workbench.

## Commands

- `npm install`
- `npm run dev`
- `npm run dev:fresh`
- `npm run typecheck`
- `npm run build`

Use `npm run dev:fresh` when Electron native modules need a clean rebuild, for example after upgrading Node or Electron. Use `npm run dev` for normal iterative work after native modules are already rebuilt.

## Local-first storage

- Development database: `../data/alpha-nexus.sqlite`
- Development vault: `../vault/`
- Packaged fallback: Electron `userData/local-first/`

## Environment variables

These are optional and should be set outside the repo, for example in your shell profile.

- `ALPHA_NEXUS_DATA_DIR`
- `ALPHA_NEXUS_VAULT_DIR`
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `CUSTOM_AI_API_BASE_URL`
- `CUSTOM_AI_API_KEY`

No real API keys are committed in this project.
