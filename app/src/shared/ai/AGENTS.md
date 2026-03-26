# AGENTS.md

## Shared AI contract rules
- Shared AI contracts must be rich enough to represent provider differences explicitly.
- Do not compress provider configuration into only `provider`, `model`, and `base_url` when auth mode, endpoint style, region, or capability flags materially differ.
- Keep provider ids stable for:
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
- When a provider needs special auth or routing semantics, encode that explicitly in shared contracts rather than leaking hidden assumptions into adapters and UI code.
