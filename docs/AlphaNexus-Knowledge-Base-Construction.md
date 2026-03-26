# AlphaNexus 知识库施工文档

版本：v1.0  
日期：2026-03-26  
状态：施工方案  
关联设计文档：`D:\AlphaNexus\docs\AlphaNexus-Design.md`  
关联 Composer 文档：`D:\AlphaNexus\docs\AlphaNexus-Context-Aware-Composer-Construction.md`  
关联计划文件：`D:\AlphaNexus\plans\2026-03-26-knowledge-base-pipeline.md`

---

## 1. 文档目的

这份文档定义 AlphaNexus 知识库系统的实施方案，覆盖以下链路：

- 资料导入
- 文档切分
- 模型抽取
- 知识卡草稿
- 人工审核
- 正式发布
- 运行时检索
- 与盘面、锚点、AI 分析、Composer 的绑定

知识库在 AlphaNexus 中不是一个孤立模块，而是所有“带先验策略信息”的能力基础。

---

## 2. 目标定义

AlphaNexus 的知识库不是用来保存“所有内容”，而是用来沉淀：

- 可复用的方法论
- 可检索的策略规则
- 可绑定盘面的判断依据
- 可供 AI 调用的已审核先验信息

目标可以概括为：

> 把书籍、课程、笔记、历史复盘中的有效方法论，转化为结构化、可审核、可检索、可落图、可持续演进的交易知识资产。

---

## 3. 核心原则

### 3.1 原文、抽取结果、正式知识分层

系统必须明确区分：

- 原始资料
- 模型抽取的草稿知识
- 用户审核后的正式知识

### 3.2 运行时只消费已审核知识

盘中 AI、Composer、锚点绑定、周/月复盘，只能使用 `approved` 知识卡。

### 3.3 知识必须可追溯

每条知识卡都必须能追溯到：

- 来源文档
- 来源片段
- 页码或章节
- 抽取任务
- 审核记录

### 3.4 知识不是聊天记忆

知识库是长期规则资产，不等于聊天上下文。

### 3.5 知识必须服务主链路

知识库的价值不在“存了很多条”，而在：

- 盘中是否能快速召回
- 是否能帮助解释标注和锚点
- 是否能提高 AI 输出一致性
- 是否能形成周/月复盘的依据

---

## 4. 功能范围

### 4.1 资料导入

支持导入：

- PDF
- Markdown
- 纯文本
- OCR 后文本
- 课程笔记整理稿

### 4.2 抽取任务

使用长文档能力较强的模型执行抽取任务。

适合模型角色：

- Gemini：长文档抽取、章节理解、批量规则归纳
- DeepSeek / 其他推理模型：运行时分析和盘面结合

### 4.3 审核工作台

提供一个专门的审核流，把草稿知识转为正式知识。

### 4.4 知识卡管理

支持：

- 编辑
- 标签
- 版本
- 归档
- 失效
- 合并重复卡片

### 4.5 运行时检索

支持按以下维度召回：

- 合约
- 周期
- 标签
- 盘面类型
- setup 类型
- 错误类型
- 当前 Trade 状态

### 4.6 Binding 与 Grounding

支持：

- 哪条知识卡对应当前盘面
- 哪条知识卡支持当前锚点
- 哪条知识卡被本次 AI 采纳
- 哪条知识卡后续被证明有效或无效

---

## 5. 用户使用场景

### 场景 A：导入一本书

1. 用户上传 PDF。
2. 系统切分章节与页码。
3. 模型抽取出术语卡、策略卡、风险卡、错误卡。
4. 草稿进入审核队列。
5. 用户批准后，正式进入知识库。

### 场景 B：盘中分析

1. 用户截图并标注。
2. 系统识别当前合约、周期、标注类型。
3. 检索相关知识卡。
4. AI 分析时带入这些卡。
5. 输出中标明本次引用了哪些知识卡。

### 场景 C：标注评估

1. 用户把 `B2` 标成“重要支撑位”。
2. 系统检索相关 support / reclaim / liquidity 卡。
3. AI 评估该标注是否合理。
4. Grounding 记录保存“这块区域为何成立”。

### 场景 D：周/月复盘

1. 系统聚合周期表现。
2. 检索相关错误模式卡和方法卡。
3. AI 在结构化统计上结合知识卡生成建议。

---

## 6. 知识对象设计

### 6.1 知识来源类型

- `book`
- `article`
- `course-note`
- `user-note`
- `review-derived`

### 6.2 知识卡类型

- `concept`
- `setup`
- `entry-rule`
- `invalidation-rule`
- `risk-rule`
- `management-rule`
- `mistake-pattern`
- `review-principle`
- `checklist`

### 6.3 知识状态

- `draft`
- `approved`
- `archived`

### 6.4 作用域

每条知识卡都建议支持以下作用域：

- `contract_scope`
- `timeframe_scope`
- `market_type_scope`
- `annotation_type_scope`
- `trade_state_scope`

---

## 7. 数据模型

### 7.1 `knowledge_sources`

记录原始资料。

字段建议：

- `id`
- `source_type`
- `title`
- `author`
- `file_path`
- `checksum`
- `language`
- `created_at`

### 7.2 `knowledge_import_jobs`

记录一次导入、切分、抽取任务。

字段建议：

- `id`
- `source_id`
- `provider`
- `model`
- `job_type`
- `status`
- `input_snapshot_json`
- `output_summary`
- `created_at`
- `finished_at`

### 7.3 `knowledge_fragments`

记录切分后的文档片段。

字段建议：

- `id`
- `source_id`
- `job_id`
- `sequence_no`
- `chapter_label`
- `page_from`
- `page_to`
- `content_md`
- `tokens_estimate`
- `created_at`

### 7.4 `knowledge_cards`

正式知识卡表。

字段建议：

- `id`
- `source_id`
- `fragment_id`
- `card_type`
- `title`
- `summary`
- `content_md`
- `trigger_conditions_md`
- `invalidation_md`
- `risk_rule_md`
- `contract_scope`
- `timeframe_scope`
- `tags_json`
- `status`
- `version`
- `created_at`
- `updated_at`

### 7.5 `knowledge_reviews`

知识审核历史。

字段建议：

- `id`
- `knowledge_card_id`
- `review_action`
- `review_note_md`
- `reviewed_by`
- `created_at`

### 7.6 `knowledge_links`

知识卡之间的关联，例如：

- 支持关系
- 冲突关系
- 派生关系

字段建议：

- `id`
- `from_card_id`
- `to_card_id`
- `link_type`
- `note_md`
- `created_at`

### 7.7 `knowledge_groundings`

知识卡与盘面、标注、锚点、AI run 的绑定。

字段建议：

- `id`
- `knowledge_card_id`
- `session_id`
- `trade_id`
- `screenshot_id`
- `annotation_id`
- `anchor_id`
- `ai_run_id`
- `match_reason_md`
- `relevance_score`
- `created_at`

---

## 8. 抽取流程

### 8.1 文档切分

切分原则：

- 优先按章节
- 次级按自然段或页码
- 保留页码范围
- 避免过大块导致抽取泛化

### 8.2 抽取输出格式

模型抽取不直接输出自由长文，而应输出结构化数组：

```json
{
  "cards": [
    {
      "card_type": "setup",
      "title": "VWAP reclaim continuation",
      "summary": "价格回到 VWAP 上方并站稳后，优先关注延续。",
      "trigger_conditions_md": "- 回到 VWAP 上方\n- 首次回踩不破\n- 主动买盘有响应",
      "invalidation_md": "重新跌回 VWAP 下方且反抽失败。",
      "risk_rule_md": "止损放在回踩低点下方。",
      "tags": ["price-action", "VWAP", "continuation"]
    }
  ]
}
```

### 8.3 抽取后处理

抽取后要做：

- schema 校验
- 重复标题检测
- 相似卡聚类
- 缺字段标记
- 自动打上 `draft`

---

## 9. 审核工作台

### 9.1 审核动作

每条草稿卡支持：

- 批准
- 批准并编辑
- 合并到已有卡
- 归档

### 9.2 审核界面建议

左右双栏：

- 左：原始片段和页码
- 右：抽取卡草稿

底部操作：

- `Approve`
- `Edit & Approve`
- `Merge`
- `Archive`

### 9.3 审核优先级

优先审核：

- 高频 setup
- 高频风控规则
- 高频错误模式

---

## 10. 运行时检索设计

### 10.1 基础检索

MVP 先走结构化过滤：

- 当前合约
- 当前周期
- 当前标注语义
- 当前 Trade 状态
- 当前页面上下文

### 10.2 检索结果组织

运行时不要回太多卡。建议：

- 3 到 8 条核心知识卡
- 1 到 3 条风险卡
- 1 到 3 条错误模式卡

### 10.3 后续增强

后续可加：

- FTS5 文本检索
- embedding 检索
- 用户接受行为驱动排序

---

## 11. 与其他模块的接入

### 11.1 与 Composer 的接入

知识卡可用于：

- 模板预填
- 候选短语
- 续写建议

### 11.2 与标注评估的接入

知识卡可用于：

- 判断标注是否符合方法论
- 给出更准确命名
- 给出失效条件

### 11.3 与 AI 市场分析的接入

运行时将相关知识卡摘要拼到 prompt：

- 相关 setup
- 风控规则
- 当前锚点相关规则
- 相关错误模式

### 11.4 与周/月复盘的接入

周期复盘时引用：

- 表现最好的 setup 卡
- 最常见错误模式卡
- 被频繁命中的风控卡

---

## 12. 提示词链路

### 12.1 文档抽取 Prompt

目标：

- 从长文档中抽取原子知识卡
- 保持来源可追溯
- 不混入无依据的自由发挥

### 12.2 运行时检索 Prompt

目标：

- 让模型知道这些是“已审核规则”
- 指明当前只允许基于相关卡分析
- 让模型返回“引用了哪些知识卡”

### 12.3 Grounding Prompt

目标：

- 把知识卡和当前标注或锚点对应起来
- 给出绑定理由
- 指出当前是否匹配

---

## 13. 实施阶段

### Phase 0：知识来源与导入

- `knowledge_sources`
- 文件导入
- 导入任务记录

### Phase 1：分块与抽取

- 文档切分
- 抽取任务
- draft 卡入库

### Phase 2：审核工作台

- 审核列表
- 原文对照
- 批准 / 合并 / 归档

### Phase 3：运行时检索

- 基础结构化过滤
- Prompt 拼装
- 与 AI run 关联

### Phase 4：Binding 与反馈

- grounding 记录
- 锚点绑定
- 结果反馈

---

## 14. 预期功能总表

### 基础功能

- 导入文档
- 分块
- 抽取草稿知识卡
- 审核与发布
- 搜索与筛选

### 运行时功能

- 按上下文召回知识卡
- 为 Composer 提供建议
- 为 AI 提供先验规则
- 为锚点提供方法论解释

### 反馈功能

- 记录某知识卡被哪些分析引用
- 记录某知识卡支持了哪些锚点
- 记录某知识卡后续是否有效

---

## 15. 验收标准

### MVP 验收

1. 用户可导入一份文档并产生草稿知识卡。
2. 草稿知识卡可审核并转为 `approved`。
3. 运行时可按合约 / 周期 / 标签检索 `approved` 知识卡。
4. 一次 AI 分析可记录引用了哪些知识卡。
5. Composer 可使用检索到的知识卡生成候选。

### 增强版验收

1. 标注和锚点可与知识卡建立 grounding。
2. 周/月复盘可引用知识卡解释表现。
3. 知识卡可以基于实际交易反馈进行版本迭代。

---

## 16. 风险与控制

### 风险 1：抽取过度泛化

控制：

- 强制分块
- 强制结构化输出
- 草稿必须审核

### 风险 2：知识重复和冲突

控制：

- 审核工作台提供合并动作
- 支持卡片链接与冲突标记

### 风险 3：知识库脱离主链路

控制：

- 任何新卡必须说明其运行时角色
- 检索链路优先服务盘中分析、标注评估和复盘

---

## 17. 结论

知识库在 AlphaNexus 中不是一个“资料仓库”，而是：

> 把外部方法论与内部复盘经验，转成可被 AI 和用户共同调用的结构化策略资产层。

它必须满足四个条件：

- 可导入
- 可审核
- 可检索
- 可绑定盘面

只有这样，它才真正能成为 AlphaNexus 的前置策略基础。
