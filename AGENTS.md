# AGENTS.md

## Project identity
- This repo is AlphaNexus, a local-first trading record, AI analysis, replay, and periodic review workbench.
- It is NOT an auto-trading system or order-execution engine.
- Human judgment stays primary; AI is assistive and auditable.
- AI must NOT become the sole source of truth for trade facts, results, or event history.

## MVP scope
- Phase 1 only includes:
  - contract and session setup
  - capture
  - annotation
  - right-side input
  - single-AI analysis
  - event stream
  - trade open and close
  - delete and restore
- Do not expand into cloud-first sync, multi-AI consensus, autonomous execution, or broad analytics unless explicitly requested.

## Architecture rules
- Preserve the core flow:
  capture -> annotation/input -> event save -> context attach -> local db/file write -> optional AI call -> structured result persistence -> event stream update -> weekly/monthly aggregation
- Keep event history append-friendly, rebuildable, and auditable.
- Preserve local-first ownership of screenshots, annotations, notes, and trade records.
- Keep user notes, AI outputs, and trade facts distinct.
- Keep write path, read/projection path, and export/sync path separate.
- Basic capture, annotation, and event persistence must not depend on AI availability.

## China LLM provider coverage
- China-provider support is a first-class requirement for AlphaNexus AI integration.
- The verified official provider families to account for as of 2026-03-26 include:
  - Alibaba Cloud DashScope / Qwen
  - Volcengine Ark / Doubao
  - Tencent Cloud Hunyuan
  - Huawei Cloud Pangu
  - Baidu Qianfan
  - DeepSeek
  - Zhipu BigModel / GLM
  - Moonshot / Kimi
  - MiniMax
  - StepFun
  - SiliconFlow
- Treat provider family, auth mode, base URL, region, endpoint style, model id, and capability matrix as explicit configuration and contracts, not scattered string literals.
- Do not assume every China provider is OpenAI-compatible; some require cloud-specific signing, IAM-style tokens, or endpoint-id routing.
- New official China providers should be added through provider metadata, adapter boundaries, tests, and docs, not by spreading provider-specific conditionals across the app.

## File growth rules
- Prefer splitting by domain:
  capture / annotation / context / event / trade / note / ai / review / storage / sync-export
- Do not add new business logic to compatibility facade files.
- If a module exceeds the agreed limit, split it before adding more logic.

### Size guidance
- service/store/domain files: soft 500, hard 800 lines
- route/controller/viewmodel files: soft 300, hard 500 lines
- model/schema files: soft 300, hard 450 lines
- React component files: soft 300, hard 500 lines
- test files: soft 400, hard 700 lines

## Change workflow
- Before coding, output:
  1. files to change
  2. files not to change
  3. plan
  4. risks
  5. tests to run
- After coding:
  - run relevant tests
  - summarize changed contracts
  - list remaining risks
  - note any follow-up splits or cleanup still needed

## Safety rails
- Do not add new production dependencies without explicit approval.
- Do not silently rename schema_version, event types, content block types, route contracts, IPC contracts, or public payload fields.
- Do not move core user assets from local-first storage to cloud-first assumptions.
- Do not make AI/network access a hard dependency for core capture, annotation, or event creation.

## Refactor rule
- For giant-file splits, schema changes, storage refactors, route reorganizations, export changes, or major UI architecture changes, write a short plan first and index it in `PLANS.md`.
- Each plan should cover scope, invariants to preserve, migration or compatibility approach, tests, and rollback notes.

## Review rule
- During review, follow `code_review.md`.
