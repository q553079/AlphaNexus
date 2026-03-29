# AlphaNexus Screenshot AI Thread And Attachments

## Goal
Turn the screenshot-level AI area into an observable conversation flow so "让 AI 参考这张图 / 保存并发给 AI / 继续追问" visibly append user and AI turns, while adding lightweight attachment support for follow-up questions.

## Scope
- Split `SessionScreenshotCard.tsx` so new screenshot-AI UI logic does not keep growing inside an already oversized component.
- Render screenshot AI history as a thread instead of a single latest-answer card.
- Show the current screenshot as a visible attachment on user asks for screenshot analysis.
- Add follow-up attachment affordances:
  - image/file picker
  - clipboard paste for images
  - attachment summary row with thumbnail or file info
- Let supported providers receive inline image attachments; unsupported providers still receive attachment metadata/text excerpts instead of silently dropping context.
- Add delete action affordance on screenshot-scoped AI replies by reusing existing soft-delete behavior.

## Files expected to change
- `D:\AlphaNexus\PLANS.md`
- `D:\AlphaNexus\plans\2026-03-28-screenshot-ai-thread-attachments.md`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionScreenshotCard.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\SessionCanvasColumn.tsx`
- `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\hooks\useSessionWorkbenchActions.ts`
- `D:\AlphaNexus\app\src\renderer\app\pages\SessionWorkbenchPage.tsx`
- `D:\AlphaNexus\app\src\renderer\app\styles\session-workbench.css`
- `D:\AlphaNexus\app\src\shared\ai\contracts.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\base.ts`
- `D:\AlphaNexus\app\src\main\ai\service.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\openai.ts`
- `D:\AlphaNexus\app\src\main\ai\adapters\custom-http.ts`
- New split files under `D:\AlphaNexus\app\src\renderer\app\features\session-workbench\`

## Invariants to preserve
- Screenshot save, note save, AI run, delete/restore, and existing local-first workbench flows keep working.
- No new hard dependency on network availability is introduced for capture, note, or event creation.
- AI output remains auditable: raw response, prompt preview, summary, and structured fields stay separate.
- Existing screenshot/AI event persistence remains additive; no event type or public payload rename is introduced.

## Migration / compatibility strategy
- Prefer additive shared AI contract fields over schema/table rewrites.
- Keep current IPC channel names unchanged.
- Derive screenshot AI thread history from existing screenshot-scoped AI events plus prompt metadata, and only use local renderer state to improve in-flight UX.
- Support attachment sending in a provider-capability-aware way:
  - OpenAI-compatible image path where supported
  - metadata/text fallback where not supported

## Tests to run
- `npm run typecheck`
- `npm run build`
- `npm run test:regression`

## Rollback notes
- Revert `SessionScreenshotCard` composition back to the previous single-panel AI summary layout.
- Remove the additive AI attachment contract fields and stop passing attachment payloads into adapters.
- Keep the existing screenshot analysis buttons and soft-delete behavior if the threaded UI introduces regressions.
