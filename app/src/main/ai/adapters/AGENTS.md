# AGENTS.md

## Adapter rules
- Keep one adapter per provider family or protocol family; do not grow a mega-adapter.
- Keep OpenAI-compatible adapters separate from cloud-signed, IAM-token, or endpoint-id-based adapters.
- Do not hide first-class China providers behind a generic `custom-http` adapter if they deserve explicit support.
- Provider metadata must explicitly capture:
  - auth mode
  - base URL or endpoint-id requirement
  - region or environment constraints
  - default model ids
  - capability differences such as streaming, tool use, file support, and structured output
- OpenAI-compatible mode is an integration detail, not a universal assumption.
- If two providers share a transport shape, reuse protocol helpers without collapsing their provider identities or capability matrices.
