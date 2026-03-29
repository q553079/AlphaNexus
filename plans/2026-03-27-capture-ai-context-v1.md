# Capture AI Context v1

## Goal
- Separate screenshot save target from AI analysis context so users can manually choose session/contract context, mark screenshots as background, and attach background notes without polluting trade facts.

## Scope
- Capture overlay UI: add explicit AI context controls next to the screenshot.
- Capture / AI contracts: carry user-selected analysis context through preload to main.
- AI prompt assembly: use explicit analysis context instead of blindly inheriting the save target session.
- Minimal provenance: persist selected analysis context through the existing AI audit trail so the prompt can be reconstructed.

## Files expected to change
- `app/src/renderer/app/pages/CaptureOverlayPage.tsx`
- `app/src/renderer/app/features/capture/CaptureOverlayComposer.tsx`
- `app/src/shared/capture/contracts.ts`
- `app/src/shared/ai/contracts.ts`
- `app/src/main/capture/capture-service.ts`
- `app/src/main/capture/capture-save-flow.ts`
- `app/src/main/ai/service.ts`
- `app/src/main/ai/prompt-builders.ts`
- `app/scripts/regression/*.test.mjs`
- `docs/AlphaNexus-PostKickoff-Implementation-Plan.md`

## Invariants to preserve
- Local-first save path stays primary: screenshot / annotation / event persistence must complete without AI.
- Renderer stays a consumer of controlled preload APIs and does not own persistence or provider logic.
- User notes, background context, AI output, and trade facts remain distinct.
- Screenshots without background tagging continue to behave as normal event analysis.

## Migration / compatibility strategy
- Prefer additive contracts.
- If no explicit AI context is selected, keep current behavior as the default fallback.
- If screenshot background metadata is absent, treat the screenshot as a normal event and do not infer background state.

## Tests to run
- `npm run test:regression`
- `npm run typecheck`
- `npm run build`

## Rollback notes
- Revert capture/AI contract additions together with overlay UI changes.
- Keep save-target behavior isolated so rollback does not affect screenshot persistence or event creation.
