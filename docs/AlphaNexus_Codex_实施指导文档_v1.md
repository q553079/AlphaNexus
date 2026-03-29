# AlphaNexus Codex 实施指导文档 v1

适用对象：Codex / Claude Code / Cursor / 任意代码代理  
适用仓库：`q553079/AlphaNexus`  
文档目的：把已经确定的产品方案，收敛成 **可直接实施** 的开发任务，不再继续产品发散。

---

## 0. 先读这段，防止做偏

### 当前共识
本轮 **不再增加新的产品方向**，只做四个收口项：

1. **事件选择模型升级**
2. **截图展示升级为分层证据流**
3. **AI 发包器 + 大 AI 深聊舱**
4. **Case / Segment 持久化**

### 明确不做
本轮禁止顺手扩这些：

- 新增新的顶级页面
- 新增复杂周报 / 高级统计图
- 新增多 AI 共识系统
- 新增概率校准 / 自动评分体系
- 新增大而全的知识库联动
- 为了“更高级”去重写整个工作台

### 总体原则
- **保持当前 Electron + React + SQLite 主骨架不变**
- **围绕 SessionWorkbench 做主改造，不新起炉灶**
- **先收主流程，再谈高级能力**
- **UI 必须围绕“图大、流顺、AI 深聊、发送可控”来组织**
- **AI 永远不是唯一事实源**

---

## 1. 现状判断

### 1.1 仓库现状
当前仓库已经具备：

- Electron 桌面壳
- React 页面骨架
- SQLite 初始化与迁移
- `SessionWorkbenchPage`
- `TradeDetailPage` / `PeriodReviewPage` 等页面
- 截图 / 标注 / AI provider / 导出骨架

这意味着当前阶段不是“从零设计”，而是 **在现有 workbench 基础上收主线**。

### 1.2 现有主问题
不是“功能太少”，而是：

- 事件流还是 **单点选择模型**，不适合多事件联看
- 截图展示还是 **顺序卡片堆叠**，不适合 2 小时大量截图
- AI 发送缺乏 **发送前可见、可选、可改、可预览** 的控制
- AI 交流区不够大，不适合多轮深聊
- 还没有 **Case / Segment** 这一层持久化单元

### 1.3 本轮目标
把系统从“能演示”推进到“能连续复盘使用”。

---

## 2. 本轮要做成什么样

### 2.1 目标工作台形态
最终目标不是一个普通笔记页，而是一个工作台：

- 左侧：**统一时间流**（Session / Events 可切）
- 中间：**大图主舞台**
- 右侧：**稳定记录区**
- 底部：**AI 摘要条 + 可拉高的大 AI 深聊舱**
- 底部或中下：**AI 发包条 / 多图托盘**
- 右侧滑出：**AI 发包器**

### 2.2 用户主流程
必须围绕这条线实现：

1. 打开 session
2. 在左侧时间流中浏览 / 选择事件
3. 在中间看大图 / 标注 / 选区
4. 把一张或多张图加入 AI 托盘
5. 选择是否带背景、是否改写背景说明
6. 发送给 AI
7. 在底部 AI 深聊舱里多轮追问
8. 从事件流中选一段，保存成 Case / Segment

---

## 3. 范围冻结

### 本轮只做四个收口项

#### A. 事件选择模型升级
把当前单选模型升级为：

- `single`
- `range`
- `pinned`

并允许：

- 单击看单事件
- Shift 选连续区间
- Pin 多条非连续事件
- 从这些选择生成组合分析视图

#### B. 截图展示升级
把当前中间画布的“截图长堆叠”改成：

- **大图主舞台**
- **底部 Filmstrip 胶片流**
- **多图分析托盘**
- **单图 / 区间 / 对照 / 拼板** 视图模式

#### C. AI 发包器 + 大 AI 深聊舱
实现：

- 快速发送
- 编辑后发送
- 多图选择
- 图像区域控制
- 背景信息开关
- 背景说明草稿可修改
- 最终预览
- AI 深聊舱可拉高、可多轮追问

#### D. Case / Segment 持久化
允许用户把一段事件流或一组 pin 事件：

- 保存成可命名的 Case / Segment
- 支持事件回放
- 支持 AI 分析
- 支持后续比较

---

## 4. 文件级实施蓝图

> 下面是给 Codex 的核心部分。请按文件拆分实施，不要写成一个巨型 PR。

### 4.1 `app/src/renderer/app/pages/SessionWorkbenchPage.tsx`

#### 现状
当前页面已经是三栏结构，整体骨架可保留。

#### 要做
- 保留顶层 page 容器
- 把布局明确调整为：
  - 左：时间流列
  - 中：大图主舞台列
  - 右：稳定记录区
  - 底：AI 区域（摘要条 + 深聊舱）
- 不再把 AI 主要回复散落在多个局部模块里
- 接入新的全局状态：
  - `selectionState`
  - `analysisTrayState`
  - `aiComposerState`
  - `aiDockState`

#### 禁止
- 不要在这个页面里继续堆业务逻辑
- 不要把选择模型写死在 page 里
- page 只做组装，不做复杂计算

---

### 4.2 `app/src/renderer/app/features/session-workbench/useSessionWorkbench.ts`

> 如果状态已经部分拆到 hooks 内，请沿现有组织方式继续拆，不要反向合并。

#### 目标
这里是本轮改造的 **核心状态入口**。

#### 必须新增的状态模型

```ts
export type EventSelectionMode = 'single' | 'range' | 'pinned'

export type EventSelectionState = {
  mode: EventSelectionMode
  primaryEventId: string | null
  selectedEventIds: string[]
  rangeAnchorId: string | null
  pinnedEventIds: string[]
}

export type AnalysisTrayItem = {
  kind: 'screenshot' | 'event'
  id: string
  screenshotId?: string
  eventId?: string
  role?: 'primary' | 'support'
}

export type AiComposerState = {
  isOpen: boolean
  primaryScreenshotId: string | null
  backgroundScreenshotIds: string[]
  includeCurrentNote: boolean
  includeEventRangeSummary: boolean
  includeTradeFacts: boolean
  includeSessionSummary: boolean
  includePriorAi: boolean
  regionMode: 'full' | 'selection' | 'annotations-only' | 'full-with-highlight'
  backgroundDraft: string
}

export type AiDockState = {
  isExpanded: boolean
  heightMode: 'peek' | 'medium' | 'large'
  activeTab: 'summary' | 'full' | 'compare' | 'similar' | 'packet'
}
```

#### 必须新增的方法
- `selectSingleEvent(eventId)`
- `togglePinEvent(eventId)`
- `selectEventRange(anchorId, targetId)`
- `clearEventSelection()`
- `addScreenshotToAnalysisTray(screenshotId)`
- `removeScreenshotFromAnalysisTray(screenshotId)`
- `setPrimaryTrayScreenshot(screenshotId)`
- `openAiComposerFromCurrentContext()`
- `openAiComposerFromSelection()`
- `closeAiComposer()`
- `updateAiComposer(patch)`
- `sendAiPacketQuick()`
- `sendAiPacketWithComposer()`
- `expandAiDock()`
- `collapseAiDock()`
- `saveSelectionAsCase()`

#### 关键要求
- `selectedEvent` 仍可保留，但要由 `selectionState.primaryEventId` 派生
- 所有旧逻辑如果依赖单选事件，先通过 `primaryEventId` 兼容
- 不要一次性删除所有旧 API，优先兼容，再逐步清理

---

### 4.3 `app/src/renderer/app/features/session-workbench/SessionEventColumn.tsx`

#### 目标
把左侧从“单选列表”升级为“统一时间脊柱”。

#### 要做
- 顶部增加切换：`Session | Events`
- 单击事件：进入 `single` 模式并设置 `primaryEventId`
- Shift 点击：创建连续区间选择
- Pin 按钮：加入 `pinnedEventIds`
- 多选时出现浮动工具条：
  - 保存为 Case
  - 加入 AI 托盘
  - 取消选择

#### Session 模式要求
- 不是另一个世界
- 只是按阶段分组显示同一条事件流
- 点开阶段后仍能回到事件级条目

#### 禁止
- 不要新建一个独立 Session 页面
- 不要让 Session / Events 成为两个完全不同的数据源

---

### 4.4 `app/src/renderer/app/features/session-workbench/SessionCanvasColumn.tsx`

#### 目标
把“媒体堆叠区”改造成“视觉主舞台”。

#### 要做
- 不再默认把所有截图大卡片堆满中间列
- 拆成 3 层：
  1. 主舞台：显示当前主图
  2. 胶片流：显示时间缩略图
  3. 多图分析模式切换：单图 / 区间 / 对照 / 拼板

#### 主舞台要求
- 显示主图
- 支持缩放 / 标注 / 框选区域 / 全屏
- 支持 `加入 AI 托盘`
- 支持 `保存为 Case`

#### 胶片流要求
- 显示时间、是否有标注、是否已入托盘、是否为关键帧
- 允许设置主图 / 附图
- 允许快速 pin

#### 多图视图要求
- **单图**：显示单张主图
- **区间**：按时间顺序串联多图
- **对照**：两组图左右对比
- **拼板**：多图 montage 视图

#### 禁止
- 不要保留“几十张大卡片从上到下堆叠”的默认展示
- 不要让 AI 长回复直接塞在每张截图卡旁边

---

### 4.5 `app/src/renderer/app/features/session-workbench/SessionScreenshotCard.tsx`

#### 目标
单张截图卡从“重操作板”改成“轻证据卡”。

#### 要做
- 保留基础元信息：时间、caption、关键状态
- 保留一键动作：
  - 设为主图
  - 加入 AI 托盘
  - 标注
  - 全屏
- `让 AI 参考这张图` 改成分裂按钮：
  - 左：快速发送
  - 右：编辑后发送

#### 精简
- 不要让完整 AI 线程长期嵌在每个截图卡内部
- 不要让截图卡承担大量文本输入职责

---

### 4.6 新增：`AiPacketComposer`（建议新组件）

建议路径：
- `app/src/renderer/app/features/session-workbench/AiPacketComposer.tsx`
- `app/src/renderer/app/features/session-workbench/modules/ai-packet-composer/*`

#### 目标
实现“发送前可见、可选、可改、可预览”。

#### UI 结构
1. **发送对象区**
   - 主图
   - 附图
   - 事件范围
   - 当前 trade / 当前 note
2. **图像区域控制区**
   - 整图
   - 框选区域
   - 仅标注区域
   - 整图 + 高亮框
3. **背景信息区**
   - 当前笔记
   - 事件区间摘要
   - Trade facts
   - Session 摘要
   - 历史 AI 回复
4. **背景说明草稿区**
   - 自动生成一段默认说明
   - 用户可直接改
5. **最终预览区**
   - 明确显示最终会发送什么

#### 要求
- 不要设计成全屏跳转页
- 使用右侧抽屉或侧滑层
- 打开 composer 时，中间主图和左侧时间流仍应可见

---

### 4.7 新增：`AiDock` / `AiDeepChatDock`

建议路径：
- `app/src/renderer/app/features/session-workbench/AiDock.tsx`

#### 目标
提供 **大的 AI 交流空间**。

#### 必须支持
- `peek / medium / large` 三种高度
- 顶部上下文 chips：
  - 主图
  - 附图数量
  - 事件区间
  - 当前 note
  - trade facts
- Tab：
  - Summary
  - Full Analysis
  - Compare
  - Similar Cases
  - Packet
- 多轮追问
- 插入当前回复到记录区
- 把当前回复保存到 Case 摘要

#### 禁止
- 不要把长对话再次散落到别的组件里
- AI 长对话只允许一个主出口

---

### 4.8 数据层：`app/src/main/db/migrations.ts`

#### 目标
新增 Case / Segment 支持。

#### 建议新增表

```sql
create table if not exists review_cases (
  id text primary key,
  session_id text not null,
  title text not null,
  summary_md text,
  ai_summary_md text,
  selection_type text not null, -- range | pinned | mixed
  started_at text,
  ended_at text,
  status text not null default 'draft', -- draft | reviewed | archived
  created_at text not null,
  updated_at text not null
);

create table if not exists review_case_events (
  id text primary key,
  review_case_id text not null,
  event_id text not null,
  sort_order integer not null,
  created_at text not null
);

create table if not exists review_case_screenshots (
  id text primary key,
  review_case_id text not null,
  screenshot_id text not null,
  role text not null default 'support', -- primary | support
  sort_order integer not null,
  created_at text not null
);

create table if not exists review_case_snapshots (
  id text primary key,
  review_case_id text not null,
  snapshot_json text not null,
  created_at text not null
);
```

#### 说明
- `review_case_snapshots` 用来冻结保存当时选择状态，防止后续原始事件变化导致 case 漂移
- 不要复用 `sessions` 作为 case 名称，避免语义冲突

---

### 4.9 IPC / contracts 层

需要同步新增：
- case 的 CRUD contract
- selection state / composer state contract（如果需要跨进程）
- 多图发送 payload contract

#### AI payload 建议结构

```ts
export type AiPacketPayload = {
  primaryScreenshotId: string | null
  backgroundScreenshotIds: string[]
  backgroundNoteMd: string
  includeTradeFacts: boolean
  includeEventRangeSummary: boolean
  includeSessionSummary: boolean
  includePriorAi: boolean
  regionMode: 'full' | 'selection' | 'annotations-only' | 'full-with-highlight'
  eventIds: string[]
  tradeId: string | null
  caseId?: string | null
}
```

---

## 5. 实施阶段拆分

### Phase 1：UI 骨架收口
目标：先让工作台形态正确。

#### 要做
- 重排 `SessionWorkbenchPage` 布局
- 左侧时间流增加 Session / Events 切换
- 中间变主舞台 + 胶片流
- 底部增加 AI 摘要条与空壳 AiDock
- 右侧保留稳定记录区

#### 验收
- 页面结构已经接近目标形态
- 即使还没有完整多选和发包逻辑，也能看出最终使用路径

---

### Phase 2：事件选择模型
目标：从单选升级到单选 + 区间 + pin。

#### 要做
- `selectionState` 上线
- 左侧支持 Shift 选区间
- 支持 pin 非连续事件
- 多选工具条出现
- 中间可根据选区切换视图模式

#### 验收
- 单事件照常能用
- 多选后不会破坏旧逻辑
- 选区可以驱动中间主舞台与 AI 上下文

---

### Phase 3：AI 发包器 + 深聊舱
目标：把 AI 从“黑箱一键按钮”升级成“可控发包 + 深聊工作台”。

#### 要做
- 分裂按钮：快速发送 / 编辑后发送
- 底部 AI 发包条
- 右侧发包器抽屉
- 多图主图 / 附图设定
- 背景开关、草稿编辑、最终预览
- 大 AI 深聊舱

#### 验收
- 用户能明确知道这次发了什么
- 用户能改背景再发
- AI 可以进行多轮追问
- 回复集中在 един一个地方（only one main output）

---

### Phase 4：Case / Segment
目标：把事件流分析结果沉淀成复盘单元。

#### 要做
- 新增 DB 表
- 新增 case 保存逻辑
- 支持从区间 / pin 保存 case
- case 保存 snapshot
- AI 回复可写入 case 摘要

#### 验收
- 用户能从事件流切一段保存
- 保存后可再次打开
- 可以恢复当时选择状态

---

## 6. 关键交互规则

### 6.1 AI 的规则
- AI 的**入口可以多**
- AI 的**长回复出口只能一个**
- 局部组件只能负责 `选择/送入/查看摘要`
- 深度对话只在 `AiDock` 内

### 6.2 事实与语境规则
- `sessions / trades / events` 继续承担事实层
- 截图、标注、笔记块是证据层 / 语境层
- AI 是分析层
- 不允许 AI 直接覆盖事实

### 6.3 截图规则
- 截图是一等对象，不是普通附件
- 必须支持：选择、排序、设主图、加入托盘、发 AI、存 case
- 默认主视图优先展示关键帧，不是所有图都放大展示

### 6.4 选择规则
- 当前主图由 `primaryEventId / primaryScreenshotId` 驱动
- 组合分析由 `selectedEventIds` 或 `analysisTray` 驱动
- 任何多选都必须支持一键清空

---

## 7. Codex 编码要求

### 7.1 必须遵守
- 小步提交，不要一个超级 PR
- 每一步都能运行
- 尽量沿用现有命名风格
- 不要把 UI 状态和数据库状态混在一起
- 不要把页面组件继续做大
- 新增复杂逻辑必须抽到 hook / module / service

### 7.2 推荐提交拆法

#### Commit 1
`refactor(workbench): prepare shell layout for timeline-stage-ai-dock`

#### Commit 2
`feat(workbench): add event selection state with single/range/pinned modes`

#### Commit 3
`feat(canvas): introduce stage view, filmstrip and analysis tray`

#### Commit 4
`feat(ai): add packet composer drawer and docked deep chat`

#### Commit 5
`feat(case): persist review cases and snapshots`

#### Commit 6
`chore(workbench): remove obsolete screenshot card ai clutter and polish flows`

---

## 8. 验收清单（必须逐项自测）

### 8.1 事件流
- [ ] 单击事件可以正常聚焦
- [ ] Shift 选区间正常
- [ ] pin 多条事件正常
- [ ] Session / Events 切换不丢上下文

### 8.2 大图主舞台
- [ ] 主图足够大
- [ ] 可放大 / 标注 / 全屏
- [ ] 胶片流可切图
- [ ] 多图模式可用

### 8.3 AI 发包器
- [ ] 单图可以快速发
- [ ] 多图可以编辑后发
- [ ] 背景开关有效
- [ ] 背景草稿可修改
- [ ] 最终预览准确

### 8.4 AI 深聊舱
- [ ] 摘要态 / 中态 / 大态可切换
- [ ] 多轮追问有效
- [ ] 能看清本次上下文
- [ ] 长回复只在主 AI 区显示

### 8.5 Case / Segment
- [ ] 可从区间保存
- [ ] 可从 pin 保存
- [ ] 可恢复 snapshot
- [ ] 可写入 AI 摘要

### 8.6 回归
- [ ] 旧的单图分析流程不崩
- [ ] 旧的导出流程不崩
- [ ] 旧的 trade 操作不崩
- [ ] 没有引入明显的状态闪烁

---

## 9. 这轮做完后，项目算完成什么

不是“做完全部产品”。
而是完成：

- 一个能沿统一事件流复盘的工作台
- 一个以大图为中心的视觉证据系统
- 一个可控的 AI 发包与深聊系统
- 一个能沉淀 case 的复盘闭环

这已经足够让 AlphaNexus 从“原型展示”进入“真实日常使用的第一版”。

---

## 10. 给 Codex 的最后一句话

不要继续发散产品。
不要新增新页面。
不要为了炫技重写架构。

请只围绕这四个收口项，按照本文档分阶段、小步、可运行地实施。

