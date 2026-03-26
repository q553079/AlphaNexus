# AlphaNexus 智能预填输入层与锚点记忆施工文档

版本：v1.0  
日期：2026-03-26  
状态：施工方案  
关联设计文档：`D:\AlphaNexus\docs\AlphaNexus-Design.md`  
关联知识库文档：`D:\AlphaNexus\docs\AlphaNexus-Knowledge-Base-Construction.md`  
关联计划文件：`D:\AlphaNexus\plans\2026-03-26-context-aware-composer.md`

---

## 1. 文档目的

这份文档定义的是 AlphaNexus 中“上下文感知输入层”相关能力的具体施工方案，覆盖以下子能力：

- 知识库导入与审核依赖
- 智能预填输入
- AI 候选标注
- 标注采纳与合并
- 锚点记忆
- 知识到盘面的绑定

这不是一个独立页面功能，而是 SessionWorkbench 的核心增强层。

---

## 2. 目标定义

目标不是做一个会聊天的输入框，而是做一个：

> 基于当前盘面、当前事件流、当前交易与当前知识上下文，给用户提供快速记录、快速采纳、快速延续记忆能力的轻量输入系统。

系统要解决的具体问题：

1. 盘中记录速度慢，重复输入多。
2. 用户对同一块关键区域的描述在不同截图之间容易断裂。
3. AI 只能给文字，不能给“可采纳的候选区域”。
4. 知识库、截图、标注、交易线程之间缺少可审计的绑定层。

这份方案默认一个前提：

> Composer 与锚点记忆不是脱离知识库单独运行，而是建立在“已审核知识卡可检索”的前提上。

---

## 3. 非目标

当前阶段不做：

- 纯自动化长期记忆写入
- 不经用户确认的 AI 自动画图落盘
- 通用大而全的自然语言输入法
- 全量向量库驱动的一切建议
- 自动替代用户正式笔记

AlphaNexus 在这条能力上的原则始终是：

- AI 可以建议
- 用户负责确认
- 记忆必须可审计

---

## 4. 功能拆分

### 4.1 Composer 智能预填

在右侧工作台的主输入框上方提供候选建议，分三类：

- `phrase`
  用于快速插入短句，例如“B2 重要支撑仍有效”

- `template`
  用于插入结构化模板，例如：
  - 观点：
  - 关键区域：
  - 触发条件：
  - 失效条件：

- `completion`
  用于续写，例如用户输入“B2 如果”，系统给出多条后续句式

### 4.2 AI 候选标注

AI 分析一次截图后，除分析卡外，还可返回候选标注：

- rectangle
- line
- arrow
- text

这些标注默认显示在单独图层，不进入正式标注集。

### 4.3 标注采纳与合并

用户对 AI 候选标注可执行：

- 保留为正式标注
- 合并到已有标注
- 丢弃

用户对自己创建的标注可执行：

- 送 AI 评估
- 标记为记忆锚点
- 标记失效

### 4.4 锚点记忆

`Market Anchor` 是后续截图和后续 AI 分析可持续引用的正式区域记忆。

锚点来源可以是：

- 用户标注采纳
- AI 标注建议被用户采纳
- 历史锚点复制延续

### 4.5 知识绑定

知识库中的规则与当前截图中的标注或锚点建立 binding：

- 哪条知识被命中
- 命中的理由
- 对应哪个区域
- 当前是否建议继续使用

### 4.6 知识导入与审核依赖

本功能依赖一个最小可用的知识库链路：

1. 用户导入 PDF / 文章 / 笔记
2. 长文档模型抽取知识卡草稿
3. 草稿进入审核区
4. 用户确认后进入 `approved` 知识卡
5. 运行时只检索已审核知识

Composer、AI 标注建议和锚点记忆都只消费 `approved` 知识卡，不直接消费原始文档或未经审核的抽取结果。

---

## 5. MVP 范围

本功能建议按 MVP 收敛，不一次性铺满。

### 5.1 MVP 必做

- 最小知识库检索能力，可按合约 / 周期 / 标签召回已审核知识卡
- 右侧输入框支持候选 Chips
- 候选支持 `phrase` 和 `template`
- 候选来源先以规则生成和上下文拼接为主
- 标注支持语义字段：标题、类型、备注、是否加入记忆
- AI 可返回候选标注，但仅支持显示、保留、丢弃
- 被采纳的标注可转成 `Market Anchor`
- 新截图分析时自动带入活跃锚点

### 5.2 MVP 暂不做

- 实时逐字预测级别的补全
- 基于用户全部历史的复杂个性化排序
- 全自动锚点失效判断
- 多模型并行生成候选文本
- 复杂向量检索驱动的候选生成
- 无审核的自动知识发布

---

## 6. 术语定义

### Annotation

截图上的几何标注对象，包含位置和轻语义。

### Annotation Suggestion

某次 AI 运行输出的候选标注，只属于该次分析，不是正式记录。

### Market Anchor

被用户确认并允许跨截图延续使用的正式语义区域。

### Note Suggestion

插入到 Composer 上方的候选短语、模板或续写。

### Grounding

知识卡、标注、锚点、AI 分析之间的绑定记录。

### Knowledge Card

由资料抽取并经过审核后可被运行时检索的结构化规则单元。

---

## 7. 交互流

### 7.1 盘中截图与输入

1. 用户截图。
2. 用户在图上画 `B1 / L1 / A1`。
3. 右侧 Composer 根据当前截图、最近事件和当前 Trade 生成候选短语。
4. 用户点选候选或自己输入。
5. 用户保存事件，必要时送 AI。

### 7.2 AI 评估我的标注

1. 用户选中某个标注，例如 `B2`。
2. 点击“评估这个标注”。
3. AI 返回：
   - 是否合理
   - 更合适的命名
   - 适合的语义类型
   - 失效条件
   - 是否建议加入记忆
4. 用户决定是否采纳。

### 7.3 AI 候选标注

1. AI 分析当前截图。
2. 返回分析卡 + 候选标注层。
3. 画布以虚线或浅色显示 AI 标注。
4. 用户逐个选择：
   - 保留
   - 丢弃
   - 合并

### 7.4 锚点延续

1. 用户把 `B3` 采纳为记忆锚点。
2. 新截图到来时，系统自动把活跃锚点摘要带入 AI。
3. Composer 候选会优先围绕当前活跃锚点生成。
4. AI 也会判断该锚点“仍有效 / 弱化 / 失效”。

### 7.5 知识导入与发布

1. 用户上传一本书或一份课程笔记。
2. 系统按章节或页码切分为片段。
3. 文档抽取模型输出 `draft knowledge cards`。
4. 用户在审核区执行：
   - 批准
   - 合并
   - 改写后批准
   - 归档
5. 只有批准后的知识卡进入运行时检索。

---

## 8. UI 方案

### 8.1 Composer 区域

位置：SessionWorkbench 右侧工作台顶部。

建议结构：

```text
┌─────────────────────────────────────────────┐
│ Active Anchors: B2 支撑区 | L1 失效线       │
├─────────────────────────────────────────────┤
│ 建议： [B2 仍有效] [回踩不破继续看多] [...] │
│ 模板： [观点模板] [执行模板] [复盘模板]     │
├─────────────────────────────────────────────┤
│ 输入框                                       │
│ 我可以自己写，也可以点选插入                │
├─────────────────────────────────────────────┤
│ 保存 | 保存并发AI | 评估当前标注            │
└─────────────────────────────────────────────┘
```

### 8.2 AI 标注层

画布中建议分三层显示：

- `My Markup`
- `AI Suggestions`
- `Adopted Anchors`

建议视觉规则：

- 我的正式标注：实线、正常饱和度
- AI 候选标注：虚线、较浅颜色
- 已采纳锚点：实线 + 锚点状态徽标

### 8.3 选中标注时的检查器

右侧检查器展示：

- 编号
- 标题
- 语义类型
- 备注
- 是否加入记忆
- AI 评估
- 相关知识卡
- 操作按钮

---

## 9. 数据模型

### 9.1 `annotations`

现有表继续承载基础几何能力，但建议扩展概念字段：

- `user_title`
- `semantic_type`
- `note_md`
- `is_memory_candidate`

如现阶段不改老表，可先通过 `annotation_meta` 或 `content_json` 承载。

### 9.2 `annotation_relations`

用于描述标注之间的关系，例如 `A1 -> B2`。

字段建议：

- `id`
- `screenshot_id`
- `from_annotation_id`
- `to_annotation_id`
- `relation_type`
- `label`
- `created_at`

### 9.3 `annotation_suggestions`

AI 生成的候选标注。

字段建议：

- `id`
- `ai_run_id`
- `session_id`
- `screenshot_id`
- `shape`
- `label`
- `title`
- `semantic_type`
- `geometry_json`
- `reason_md`
- `confidence`
- `status` (`suggested / adopted / merged / discarded`)
- `adopted_annotation_id`
- `created_at`

### 9.4 `market_anchors`

用户采纳后的长期区域记忆。

字段建议：

- `id`
- `contract_id`
- `session_id`
- `trade_id`
- `origin_annotation_id`
- `origin_screenshot_id`
- `title`
- `semantic_type`
- `price_low`
- `price_high`
- `timeframe_scope`
- `thesis_md`
- `invalidation_rule_md`
- `status` (`active / invalidated / archived`)
- `carry_forward`
- `created_at`
- `updated_at`

### 9.5 `anchor_reviews`

记录 AI 或用户对锚点的复核。

字段建议：

- `id`
- `anchor_id`
- `review_source` (`ai / user / system`)
- `session_id`
- `screenshot_id`
- `review_result`
- `reason_md`
- `confidence`
- `created_at`

### 9.6 `note_suggestions`

Composer 候选内容。

字段建议：

- `id`
- `session_id`
- `trade_id`
- `event_id`
- `screenshot_id`
- `anchor_id`
- `source` (`rule / ai / history`)
- `suggestion_type` (`phrase / template / completion`)
- `text`
- `context_snapshot_json`
- `rank_score`
- `accepted`
- `accepted_at`
- `created_at`

### 9.7 `knowledge_groundings`

知识与盘面的绑定记录。

字段建议：

- `id`
- `knowledge_card_id`
- `session_id`
- `screenshot_id`
- `annotation_id`
- `anchor_id`
- `ai_run_id`
- `match_reason_md`
- `relevance_score`
- `created_at`

### 9.8 `knowledge_import_jobs`

记录一次文档导入与抽取任务。

字段建议：

- `id`
- `source_id`
- `provider`
- `model`
- `status`
- `input_file_path`
- `output_summary`
- `created_at`
- `finished_at`

### 9.9 `knowledge_fragments`

记录文档分块后的片段。

字段建议：

- `id`
- `source_id`
- `job_id`
- `sequence_no`
- `page_from`
- `page_to`
- `content_md`
- `embedding_ref`
- `created_at`

### 9.10 `knowledge_cards`

知识库正式卡片，供运行时检索。

字段建议：

- `id`
- `source_id`
- `fragment_id`
- `card_type`
- `title`
- `summary`
- `content_md`
- `contract_scope`
- `timeframe_scope`
- `tags_json`
- `status`
- `version`
- `created_at`
- `updated_at`

### 9.11 `knowledge_reviews`

知识卡审核记录。

字段建议：

- `id`
- `knowledge_card_id`
- `review_action`
- `review_note_md`
- `reviewed_by`
- `created_at`

---

## 10. 建议生成策略

### 10.1 V1：规则驱动

先基于当前上下文生成候选，不依赖额外模型调用。

此处“规则”包含两类来源：

- 产品内置规则
- 已审核知识卡

示例规则：

- 当前选中 `support` 标注
  - `B2 重要支撑仍有效`
  - `若跌破 B2，则支撑失效`
  - `回踩 B2 不破可继续观察做多`

- 当前存在 open trade
  - `继续持有，观察回踩承接`
  - `止损不放宽`
  - `到达前高前先看减仓`

- 当前是 exit 截图
  - `离场原因：`
  - `执行偏差：`
  - `是否按计划退出：`

### 10.2 V2：AI 增强

在规则候选之上，追加 AI 候选：

- 更贴近当前盘面
- 更贴近用户当前锚点
- 更贴近最近一次分析卡
- 更贴近当前命中的知识卡

但排序上仍建议：

- 规则候选优先
- AI 候选补充

---

## 11. AI Prompt 设计

### 11.1 标注评估 Prompt

输入：

- 当前截图摘要
- 当前标注几何与标签
- 用户备注
- 当前活跃锚点
- 相关知识卡摘要

输出：

- 是否合理
- 建议命名
- 建议语义类型
- 失效条件
- 是否建议加入记忆

### 11.2 候选标注 Prompt

输入：

- 当前截图摘要
- 用户已有标注
- 最近事件流摘要
- 当前活跃锚点
- 相关知识卡摘要

输出：

- 候选标注数组
- 每条标注的理由
- 置信度

### 11.3 Composer 候选 Prompt

输入：

- 当前上下文快照
- 当前用户已输入文本
- 当前选中的标注或锚点
- 当前 Trade 状态
- 当前命中的知识卡摘要

输出：

- 短语候选
- 模板候选
- 续写候选

---

## 12. 服务边界

建议拆成以下服务，不把逻辑塞进 React 组件：

- `knowledge-ingestion-service`
  管理导入、分块、抽取、审核

- `knowledge-retrieval-service`
  管理 approved 知识卡召回
- `annotation-service`
  管理正式标注、关系与采纳

- `anchor-service`
  管理 `Market Anchor` 状态和 carry-forward

- `composer-service`
  负责候选生成、排序、接受记录

- `grounding-service`
  管理知识与盘面的绑定关系

- `ai-service`
  统一处理标注评估、候选标注生成、候选文本生成

---

## 13. 实施阶段

### Phase 0：知识库基础链路

- 文档导入记录
- 分块与抽取任务
- draft / approved 审核状态
- 运行时最小检索接口

### Phase A：Composer 基础版

- 候选 Chips UI
- 模板插入
- 规则候选生成
- 建议接受记录

### Phase B：标注语义化

- 标注标题 / 类型 / 备注
- 标注关系
- “加入记忆”开关

### Phase C：AI 候选标注

- AI suggestion schema
- 画布候选层
- 保留 / 丢弃 / 合并

### Phase D：锚点记忆

- `Market Anchor`
- 活跃锚点列表
- 新截图自动带入
- 锚点评估状态流转

### Phase E：知识绑定

- 相关知识卡召回
- grounding 入库
- 在检查器中显示“这块区域为何成立”

---

## 14. 验收标准

### MVP 验收

1. 系统可从已审核知识卡中检索相关规则摘要。
2. 用户可以在主输入框看到上下文相关候选。
3. 用户可点击候选插入，也可完全自己写。
4. 标注可保存标题、类型和备注。
5. AI 可返回候选标注，且默认不污染正式标注集。
6. 用户可把某个标注采纳为锚点。
7. 新截图的 AI 分析会带入活跃锚点和相关知识卡。

### 增强版验收

1. 锚点能跨截图持续复核。
2. 相关知识卡能与标注或锚点建立绑定。
3. 候选内容排序能利用用户历史接受行为。

---

## 15. 风险与控制

### 风险 1：AI 候选过多，干扰主流程

控制：

- 默认只展示少量高分候选
- 优先展示规则候选
- AI 候选支持折叠

### 风险 2：自动记忆污染

控制：

- 不允许 AI 直接进入长期记忆
- 只有用户采纳后的区域才升级为锚点

### 风险 2.5：未经审核的知识污染运行时分析

控制：

- 抽取结果先进入 draft
- 运行时只取 approved 知识卡
- grounding 记录必须保留来源卡片与来源片段

### 风险 3：语义与几何脱节

控制：

- 锚点必须保留来源标注
- 标注关系独立建模
- 后续截图优先复核语义状态，而不是复用旧像素

---

## 16. 结论

这项能力的正确落地方式不是“做一个更聪明的输入框”，而是：

> 把输入、标注、知识、AI 建议和长期区域记忆统一到同一条可审计的事件流中。

只要坚持以下三条，AlphaNexus 的这块能力就会成立：

- 用户始终掌握最终采纳权
- 记忆始终基于结构化锚点，而不是纯聊天上下文
- 候选始终服务记录效率，而不是替代用户表达
