# AlphaNexus Knowledge Base Pipeline

## Goal
Add a local-first knowledge-base pipeline that can ingest long-form source material, extract draft strategy cards, support human review, and expose approved knowledge cards to runtime AI analysis, composer suggestions, and grounding.

## Scope
- Define source, fragment, import-job, knowledge-card, review, and grounding storage contracts.
- Support a draft-to-approved review flow for extracted strategy knowledge.
- Expose runtime retrieval APIs for approved knowledge cards.
- Keep the pipeline compatible with local-first AlphaNexus storage and event history.

## Files expected to change
- `D:\AlphaNexus\docs\AlphaNexus-Design.md`
- `D:\AlphaNexus\docs\AlphaNexus-Knowledge-Base-Construction.md`
- `D:\AlphaNexus\docs\AlphaNexus-PostKickoff-Implementation-Plan.md`
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-26-knowledge-base-pipeline.md`
- Future implementation is expected to touch:
  - `D:\AlphaNexus\app\src\main\ai\...`
  - `D:\AlphaNexus\app\src\main\storage\...`
  - `D:\AlphaNexus\app\src\main\db\...`
  - `D:\AlphaNexus\app\src\renderer\app\pages\...`
  - `D:\AlphaNexus\app\src\renderer\app\features\...`

## Invariants to preserve
- Runtime AI analysis must not depend on unreviewed draft knowledge.
- Original source materials, extracted drafts, and approved cards remain distinct.
- Knowledge retrieval must stay local-first and auditable.
- Knowledge cards must keep source traceability.

## Migration / compatibility strategy
- Introduce the knowledge pipeline additively.
- Keep existing AI analysis working without knowledge retrieval until runtime hooks are added.
- Start with structured filter retrieval before adding semantic search.

## Tests to run
- Document consistency check across design, construction, and plan docs.
- Future implementation should cover:
  - source import and fragment creation
  - draft card extraction schema validation
  - review state transitions
  - runtime retrieval filters

## Rollback notes
- Disable runtime knowledge retrieval while retaining imported assets and approved cards on disk.
- Revert grounding and composer integration without deleting approved knowledge records.
