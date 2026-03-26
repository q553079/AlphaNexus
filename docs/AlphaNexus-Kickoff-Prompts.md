# AlphaNexus 项目启动 Prompts

版本：v1.0  
日期：2026-03-25  
用途：用于 Codex / Claude Code / 支持并行 agent 的开发环境，快速启动 AlphaNexus 项目

---

## 1. 使用方式

推荐开 1 个主控线程 + 5 个并行工作线程。

- 主控线程负责：
  - 初始化仓库与目录
  - 分配任务
  - 等待各线程完成
  - 最后做集成和联调

- 5 个工作线程分别负责：
  - 线程 1：桌面壳与工程骨架
  - 线程 2：数据库与领域模型
  - 线程 3：UI 外壳与页面框架
  - 线程 4：截图与标注能力
  - 线程 5：AI 适配层与 Markdown 导出

关键规则：

- 所有线程共享同一个仓库。
- 每个线程只修改自己拥有的文件范围。
- 不要回滚或覆盖其他线程的改动。
- 如果必须跨范围修改，只允许改一个最小集成点，并在最终汇报里说明。

---

## 2. 主控线程 Prompt

复制以下内容给主控线程：

```text
你是 AlphaNexus 项目的主控工程代理。请在 D:\AlphaNexus 中启动一个新的本机桌面应用项目。

项目目标：
AlphaNexus 是一个本机优先的交易记录、AI 分析、截图标注、事件流复盘和周/月聚合工作台。

核心要求：
1. 技术栈使用 Electron + React + TypeScript + Vite。
2. 本地存储使用 SQLite。
3. UI 风格要求干净、清爽、专业、Light First，不做噪声型交易终端风格。
4. 主界面必须围绕 Session 事件流、图像/内容画布、右侧工作台设计。
5. 支持 Session、Trade、Event、Content Block、Screenshot、AI Analysis 等核心概念。
6. 支持后续接 OpenAI、Claude 和第三方 API。
7. 项目必须是 local-first，笔记导出为 Markdown，图片单独存储。

你的职责：
1. 初始化项目骨架和基础目录。
2. 按下面的工作拆分并行安排 5 个子线程。
3. 子线程完成后，负责集成它们的成果。
4. 确保项目至少达到一个可启动、可预览的里程碑：
   - Electron 窗口可打开
   - React 页面可渲染
   - 基础路由可用
   - SQLite 初始化可跑
   - Session 工作台页有基础 UI
   - 支持插入 mock 事件流数据
   - AI 配置和导出模块有接口骨架

项目目录建议：
D:\AlphaNexus\
  app\
    package.json
    electron.vite.config.ts
    tsconfig.json
    src\
      main\
      preload\
      renderer\
      shared\
  data\
  vault\

工程要求：
1. 类型定义清晰。
2. 代码注释简洁，不要堆注释。
3. 用 zod 或同类方案约束关键 schema。
4. 默认放入少量 mock 数据，便于 UI 联调。
5. 不要做过度工程化；先做出一个可运行的基础版本。

并行线程安排：
- 线程 1：桌面壳与工程骨架
- 线程 2：数据库与领域模型
- 线程 3：UI 外壳与页面框架
- 线程 4：截图与标注能力
- 线程 5：AI 适配层与 Markdown 导出

最后输出：
1. 当前完成了什么
2. 哪些线程结果已集成
3. 还剩什么阻塞点
4. 下一步最合理的开发顺序
```

---

## 3. 线程 1 Prompt：桌面壳与工程骨架

复制以下内容给线程 1：

```text
你负责 AlphaNexus 的桌面壳与工程骨架搭建。

工作目录：
D:\AlphaNexus\app

你不是唯一在代码库里工作的代理。不要回滚其他人的改动，不要覆盖其他线程的文件。你只拥有以下写入范围：
- D:\AlphaNexus\app\package.json
- D:\AlphaNexus\app\electron.vite.config.ts
- D:\AlphaNexus\app\tsconfig*.json
- D:\AlphaNexus\app\vite*.config.*
- D:\AlphaNexus\app\src\main\app-shell\**
- D:\AlphaNexus\app\src\preload\**
- D:\AlphaNexus\app\src\renderer\app\bootstrap\**
- D:\AlphaNexus\app\README.md

目标：
1. 初始化 Electron + React + TypeScript + Vite 工程。
2. 建立 main / preload / renderer / shared 的基础目录结构。
3. 配置基础启动、开发和打包脚本。
4. 建立基础窗口、preload 通信壳、路由入口和应用挂载点。
5. 提供基础环境变量读取方案，但不要写入真实 API Key。

要求：
1. 默认窗口标题为 AlphaNexus。
2. Renderer 至少能打开一个 AppShell 页面。
3. 提供最小的 IPC 示例，供后续数据库和截图模块接入。
4. 保持工程结构清晰，不要把所有逻辑塞进单文件。
5. 如果需要依赖，优先选择稳定、常见的实现。

交付标准：
1. npm install 后可启动。
2. Electron 窗口能渲染 React 应用。
3. 有基础开发命令和构建命令。
4. 在最终答复中列出你修改的文件路径。
```

---

## 4. 线程 2 Prompt：数据库与领域模型

复制以下内容给线程 2：

```text
你负责 AlphaNexus 的数据库、领域模型与 mock 数据。

工作目录：
D:\AlphaNexus\app

你不是唯一在代码库里工作的代理。不要回滚其他人的改动，不要覆盖其他线程的文件。你只拥有以下写入范围：
- D:\AlphaNexus\app\src\main\db\**
- D:\AlphaNexus\app\src\main\domain\**
- D:\AlphaNexus\app\src\shared\contracts\**
- D:\AlphaNexus\app\src\shared\mock-data\**

目标：
1. 用 SQLite 为 AlphaNexus 建立第一版数据层。
2. 定义核心实体：
   - Contract
   - Period
   - Session
   - Trade
   - Event
   - Screenshot
   - Annotation
   - ContentBlock
   - AiRun
   - AnalysisCard
   - Evaluation
3. 提供数据库初始化脚本和 migration 基础机制。
4. 提供 mock 数据生成，用于 UI 页面联调。
5. 提供最小 repository / service 层封装，不要过度抽象。

要求：
1. 数据结构要支持：
   - 当前上下文挂载
   - 内容块移动
   - 软删除
   - 周/月聚合扩展
2. 为关键 schema 提供 zod 校验或等价方案。
3. 提供至少一组完整 mock：
   - 一个 Contract
   - 一个 Session
   - 三个 Event
   - 一笔 Trade
   - 一张 Screenshot
   - 一个 AI AnalysisCard
4. 输出要便于后续 UI 直接消费。

交付标准：
1. 数据库初始化代码可运行。
2. mock 数据可被 renderer 页面读到。
3. 类型定义清晰，命名统一。
4. 在最终答复中列出你修改的文件路径。
```

---

## 5. 线程 3 Prompt：UI 外壳与页面框架

复制以下内容给线程 3：

```text
你负责 AlphaNexus 的 UI 外壳、页面框架和设计系统基础。

工作目录：
D:\AlphaNexus\app

你不是唯一在代码库里工作的代理。不要回滚其他人的改动，不要覆盖其他线程的文件。你只拥有以下写入范围：
- D:\AlphaNexus\app\src\renderer\app\ui\**
- D:\AlphaNexus\app\src\renderer\app\routes\**
- D:\AlphaNexus\app\src\renderer\app\pages\**
- D:\AlphaNexus\app\src\renderer\app\components\**
- D:\AlphaNexus\app\src\renderer\app\styles\**

目标：
1. 建立 AlphaNexus 的基础 UI 壳。
2. 实现 4 个页面框架：
   - Home
   - SessionWorkbench
   - TradeDetail
   - PeriodReview
3. 建立基础布局：
   - 顶栏
   - 左侧事件流
   - 中间画布区域
   - 右侧工作台
4. 用 mock 数据把页面先跑起来。

设计要求：
1. Light First。
2. 干净、清爽、专业。
3. 不要使用默认系统审美，不要做紫色发光风格。
4. 定义清楚的 CSS 变量或 design tokens。
5. 保证桌面宽屏下观感稳定。

UI 要点：
1. SessionWorkbench 必须体现三栏结构。
2. Event card、AI summary card、Trade card、Review card 需要最小可用样式。
3. 右侧工作台要留出“我的实时看法 / AI 分析 / 交易计划”三个分区或 tab。
4. 页面要有真实产品感，不要只是方框占位。

约束：
1. 不要修改 main / preload / db 文件。
2. 数据先通过 shared mock types 接入。
3. 如果缺少接口，可先写 adapter 层，不要侵入其他线程文件。

交付标准：
1. 4 个页面都能渲染。
2. SessionWorkbench 是当前最完整页面。
3. 基础设计 token 和通用卡片组件已成型。
4. 在最终答复中列出你修改的文件路径。
```

---

## 6. 线程 4 Prompt：截图与标注能力

复制以下内容给线程 4：

```text
你负责 AlphaNexus 的截图、标注与截图事件创建能力。

工作目录：
D:\AlphaNexus\app

你不是唯一在代码库里工作的代理。不要回滚其他人的改动，不要覆盖其他线程的文件。你只拥有以下写入范围：
- D:\AlphaNexus\app\src\main\capture\**
- D:\AlphaNexus\app\src\renderer\app\features\capture\**
- D:\AlphaNexus\app\src\renderer\app\features\annotation\**
- D:\AlphaNexus\app\src\shared\capture\**

目标：
1. 为 AlphaNexus 建立第一版截图与标注能力。
2. 实现最小链路：
   - 触发截图入口
   - 打开截图/标注 UI
   - 支持添加矩形、圆、线、箭头、文本
   - 自动编号 B1/B2/L1/A1
   - 输出标注 JSON
3. 提供“保存到当前上下文”的数据结构。
4. 预留“保存并发 AI”“保存为 Exit 图”的接口。

要求：
1. 可先做应用内截图流程或占位流程，不要求第一版就做完美系统级区域截图。
2. 标注层推荐使用 Fabric.js 或等价实现。
3. 标注结果必须包含几何信息、编号和颜色。
4. 设计一个 CaptureResult schema，后续供数据库和导出模块使用。
5. UI 应尽量和主工作台风格一致。

约束：
1. 不要修改 db 和 ai 文件。
2. 如果需要 IPC，只通过最小接口与主线程交互。
3. 不要做复杂图片处理管线，先做可用版本。

交付标准：
1. 能在页面中看到标注界面。
2. 能创建至少 3 种标注并导出结构化结果。
3. 有保存 payload 的清晰类型定义。
4. 在最终答复中列出你修改的文件路径。
```

---

## 7. 线程 5 Prompt：AI 适配层与 Markdown 导出

复制以下内容给线程 5：

```text
你负责 AlphaNexus 的 AI 适配层、结构化输出 schema 和 Markdown 导出。

工作目录：
D:\AlphaNexus\app

你不是唯一在代码库里工作的代理。不要回滚其他人的改动，不要覆盖其他线程的文件。你只拥有以下写入范围：
- D:\AlphaNexus\app\src\main\ai\**
- D:\AlphaNexus\app\src\main\export\**
- D:\AlphaNexus\app\src\shared\ai\**
- D:\AlphaNexus\app\src\shared\export\**

目标：
1. 设计 AlphaNexus 的 AI provider adapter 层。
2. 支持以下 provider 骨架：
   - OpenAI
   - Anthropic
   - Custom HTTP API
3. 定义统一输出 schema：
   - bias
   - confidence_pct
   - reversal_probability_pct
   - entry_zone
   - stop_loss
   - take_profit
   - invalidation
   - summary_short
   - deep_analysis_md
4. 提供 prompt builder 基础结构：
   - 当前市场分析
   - 交易级复盘
   - 周/月复盘
5. 实现 Session 导出为 Markdown 的第一版。

要求：
1. API 调用代码要可替换，可 mock。
2. schema 用 zod 或等价方案约束。
3. Markdown 导出要考虑：
   - 图片引用
   - 事件流顺序
   - AI 摘要
   - 用户笔记
4. 不要在第一版接入真实密钥，只做接口和调用骨架。

约束：
1. 不要修改 renderer UI 文件，除非新建一个极小的 demo adapter。
2. 不要侵入数据库层；通过 shared types 对接。
3. 导出逻辑先做到 Session 级，Trade/Week/Month 可预留接口。

交付标准：
1. provider adapter 结构清晰。
2. AI 输出 schema 完整。
3. 有一个可运行的 mock 分析流程。
4. Markdown 导出函数能输出文本结果。
5. 在最终答复中列出你修改的文件路径。
```

---

## 8. 集成阶段 Prompt

当 5 个线程都完成后，把下面的 Prompt 给主控线程做集成：

```text
现在开始集成 AlphaNexus 的并行工作结果。

目标：
1. 汇总各线程的实现结果。
2. 修正类型引用、路径、依赖和最小启动问题。
3. 确保项目至少达到以下里程碑：
   - Electron 可启动
   - Home / SessionWorkbench / TradeDetail / PeriodReview 页面可访问
   - SessionWorkbench 能显示 mock 事件流
   - 右侧工作台能显示我的看法和 AI 摘要示例
   - 数据层初始化可跑
   - Capture/Annotation 模块能显示 demo UI
   - AI provider 和 Markdown export 有可调用入口

约束：
1. 优先修集成问题，不做大改。
2. 不要重写子线程已有实现。
3. 对冲突部分做最小修补。
4. 如果有未完成模块，用 mock 或 stub 保证主流程可演示。

最后输出：
1. 当前可运行功能
2. 未完成功能
3. 技术债列表
4. 下一步最优先的 5 项工作
```

---

## 9. 推荐的首轮集成目标

第一轮不要追求全功能，先做出一个能演示的纵向切片：

1. 打开 AlphaNexus 桌面窗口
2. 进入 SessionWorkbench
3. 左侧看到事件流
4. 中间看到截图/画布区域
5. 右侧能编辑一段“我的实时看法”
6. 能显示一张 mock 图和一个 mock AI 摘要卡
7. 能把 Session 导出为 Markdown

只要这个链路成立，项目就已经真正启动了。

---

## 10. 主控线程的补充要求

如果你的 agent 平台支持真正的并行子线程，请按以下顺序组织：

1. 先由主控线程创建目录与空仓库。
2. 立刻并行启动线程 1 到线程 5。
3. 主控线程等待线程 1 和线程 2 先完成。
4. 在线程 1 和线程 2 产出基础结构后，优先集成线程 3。
5. 最后接线程 4 和线程 5。

原因：

- 线程 1 提供工程基础
- 线程 2 提供 shared types 和数据结构
- 线程 3 依赖前两者最强
- 线程 4 和线程 5 更适合后接

---

## 11. 如果只能单线程执行

如果你的环境不支持并行，就按以下顺序顺序执行同样的工作：

1. 工程骨架
2. 数据层
3. UI 壳
4. 截图与标注
5. AI 适配与导出
6. 集成

---

## 12. 最终说明

这套 prompts 的目标不是一次性做完 AlphaNexus，而是把项目从“设计阶段”推进到“能跑、能看、能继续做”的第一阶段。

第一轮完成后，下一轮最值得继续拆分的方向是：

- Trade 线程深度页
- 周/月 KPI 页面
- 当前上下文切换器
- 回收站与删除恢复
- 真正的系统级截图能力

