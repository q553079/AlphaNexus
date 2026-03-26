# AGENTS.md

## AI service rules
- The AI service layer must treat both direct model vendors and routed model platforms as first-class citizens.
- The verified official China-provider families to account for as of 2026-03-26 are:
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
- Provider registry owns provider metadata: provider key, label, auth mode, base URL or endpoint style, regional constraints, model family, and capability flags.
- Do not scatter provider-specific URLs, model ids, or auth assumptions across `service.ts`, UI code, and prompt builders.
- Adding a provider requires synchronized updates to provider metadata, shared contracts, docs, and tests.
