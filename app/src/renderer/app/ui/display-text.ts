import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { SessionBucket } from '@shared/contracts/launcher'
import type {
  FeedbackItem,
  RuleRollupEntry,
} from '@shared/contracts/evaluation'
import type {
  PeriodTagCategory,
  PeriodTagSource,
  TradeMetricResultLabel,
} from '@shared/contracts/period-review'
import type { SessionRecord } from '@shared/contracts/session'
import type { TradeRecord } from '@shared/contracts/trade'
import type { CurrentTargetOption } from '@shared/contracts/workbench'

export type EventStreamFilterKey = 'all' | 'screenshot' | 'ai' | 'trade' | 'review'

type CaptureKind = ScreenshotRecord['kind']
type AnnotationShape = ScreenshotRecord['annotations'][number]['shape']

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

const sessionStatusLabels: Record<SessionRecord['status'], string> = {
  planned: '计划中',
  active: '进行中',
  closed: '已关闭',
}

const marketBiasLabels: Record<SessionRecord['market_bias'], string> = {
  neutral: '中性',
  bullish: '偏多',
  bearish: '偏空',
  range: '震荡',
}

const tradeSideLabels: Record<TradeRecord['side'], string> = {
  long: '做多',
  short: '做空',
}

const tradeStatusLabels: Record<TradeRecord['status'], string> = {
  planned: '计划中',
  open: '持仓中',
  closed: '已关闭',
  canceled: '已取消',
}

const eventTypeLabels: Record<EventRecord['event_type'], string> = {
  observation: '观察',
  thesis: '观点',
  trade_open: '开仓',
  trade_add: '加仓',
  trade_reduce: '减仓',
  trade_close: '平仓',
  trade_cancel: '取消',
  screenshot: '截图',
  ai_summary: 'AI 摘要',
  review: '复盘',
}

const captureKindLabels: Record<CaptureKind, string> = {
  chart: '图表',
  execution: '成交',
  exit: '离场',
}

const contextTypeLabels: Record<ContentBlockRecord['context_type'], string> = {
  session: '工作过程',
  event: '事件',
  trade: '交易',
  period: '周期',
}

const annotationShapeLabels: Record<AnnotationShape, string> = {
  rectangle: '矩形',
  ellipse: '圆形',
  line: '线段',
  arrow: '箭头',
  text: '文本',
  brush: '画笔',
  fib_retracement: '斐波那契',
}

const sessionBucketLabels: Record<SessionBucket, string> = {
  am: '上午',
  pm: '下午',
  night: '夜盘',
  custom: '自定义',
}

const eventStreamFilterLabels: Record<EventStreamFilterKey, string> = {
  all: '全部',
  screenshot: '截图',
  ai: 'AI',
  trade: '交易',
  review: '复盘',
}

const annotationSemanticLabels: Record<NonNullable<ScreenshotRecord['annotations'][number]['semantic_type']>, string> = {
  support: '支撑',
  resistance: '阻力',
  liquidity: '流动性',
  fvg: '公允价值缺口',
  imbalance: '失衡区',
  entry: '入场',
  invalidation: '失效位',
  target: '目标位',
  path: '路径',
  context: '背景',
}

const screenshotBackgroundLayerLabels: Record<NonNullable<ScreenshotRecord['background_layer']>, string> = {
  macro: '宏观',
  htf: '高周期',
  structure: '结构',
  execution: '执行',
  custom: '自定义',
}

const tradeMetricResultLabels: Record<TradeMetricResultLabel, string> = {
  win: '盈利',
  loss: '亏损',
  flat: '持平',
  pending: '待定',
  canceled: '已取消',
}

const periodTagCategoryLabels: Record<PeriodTagCategory, string> = {
  setup: '形态',
  context: '背景',
  mistake: '错误',
  emotion: '情绪',
}

const periodTagSourceLabels: Record<PeriodTagSource, string> = {
  user: '用户',
  system: '系统',
  ai: 'AI',
}

const feedbackTypeLabels: Record<FeedbackItem['type'], string> = {
  discipline: '纪律',
  'setup-selection': '形态选择',
  execution: '执行',
  risk: '风险',
  'anchor-usage': '锚点使用',
  'knowledge-gap': '知识缺口',
}

const feedbackPriorityLabels: Record<FeedbackItem['priority'], string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
}

const ruleSeverityLabels: Record<RuleRollupEntry['severity'], string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
}

const calibrationStatusLabels: Record<'ok' | 'sparse' | 'pending', string> = {
  ok: '正常',
  sparse: '样本偏少',
  pending: '待观察',
}

const englishMonthMap: Record<string, string> = {
  january: '1月',
  february: '2月',
  march: '3月',
  april: '4月',
  may: '5月',
  june: '6月',
  july: '7月',
  august: '8月',
  september: '9月',
  october: '10月',
  november: '11月',
  december: '12月',
}

const translateLegacySessionTitle = (value: string) => {
  const trimmed = value.trim()
  const autoLegacyMatch = /^([A-Za-z]+)\s+(\d{1,2})\s+(Morning|Afternoon|Night)\s+Session$/i.exec(trimmed)
  if (autoLegacyMatch) {
    const [, month, day, bucket] = autoLegacyMatch
    const monthLabel = englishMonthMap[month.toLowerCase()] ?? month
    const bucketLabel = bucket.toLowerCase() === 'morning'
      ? '上午'
      : bucket.toLowerCase() === 'afternoon'
        ? '下午'
        : '夜盘'
    return `${monthLabel}${day}日${bucketLabel}工作过程`
  }

  const mixedAutoMatch = /^([A-Z0-9]+)\s+(上午|下午|夜盘|自定义)\s+Session\s+·\s+(\d{4}-\d{2}-\d{2})$/i.exec(trimmed)
  if (mixedAutoMatch) {
    const [, symbol, bucket, date] = mixedAutoMatch
    return `${symbol} ${bucket}工作过程 · ${date}`
  }

  return trimmed
}

const translateLegacyContextFocus = (value: string) => {
  const trimmed = value.trim()
  if (trimmed === 'Session event stream with annotated chart context.') {
    return '围绕图表、标注和事件顺着往下记录。'
  }
  return trimmed
}

const replaceTargetSubtitleTerms = (value: string) =>
  value
    .replace(/\bSession\b/g, '工作过程')
    .replace(/\bTrade\b/g, '交易')
    .replace(/工作过程 级目标/g, '工作过程级目标')
    .replace(/交易 级目标/g, '交易级目标')

const translatePeriodLabel = (value: string) => value.replace(/\b(\d{4})\s+W(\d{1,2})\b/g, '$1 第$2周')

export const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value))

export const formatTime = (value: string) => timeFormatter.format(new Date(value))

export const translateSessionStatus = (status: SessionRecord['status']) => sessionStatusLabels[status] ?? status

export const translateMarketBias = (bias: SessionRecord['market_bias']) => marketBiasLabels[bias] ?? bias

export const translateAnalysisBias = (bias: AnalysisCardRecord['bias']) => marketBiasLabels[bias] ?? bias

export const translateTradeSide = (side: TradeRecord['side']) => tradeSideLabels[side] ?? side

export const translateTradeStatus = (status: TradeRecord['status']) => tradeStatusLabels[status] ?? status

export const translateEventType = (eventType: EventRecord['event_type']) => eventTypeLabels[eventType] ?? eventType

export const translateEventStreamFilter = (filter: EventStreamFilterKey) => eventStreamFilterLabels[filter] ?? filter

export const translateCaptureKind = (kind: CaptureKind) => captureKindLabels[kind] ?? kind

export const translateContextType = (contextType: ContentBlockRecord['context_type']) => contextTypeLabels[contextType] ?? contextType

export const translateAnnotationShape = (shape: AnnotationShape) => annotationShapeLabels[shape] ?? shape

export const translateAnnotationSemantic = (semanticType: string | null | undefined) =>
  semanticType ? annotationSemanticLabels[semanticType as keyof typeof annotationSemanticLabels] ?? semanticType : '未指定'

export const translateSessionBucket = (bucket: SessionBucket) => sessionBucketLabels[bucket] ?? bucket

export const formatTradeBadgeLabel = (trade: TradeRecord) => `${trade.symbol} ${translateTradeSide(trade.side)}`

export const translateScreenshotBackgroundLayer = (layer: ScreenshotRecord['background_layer']) =>
  layer ? screenshotBackgroundLayerLabels[layer] ?? layer : '未指定'

export const translateTradeMetricResultLabel = (label: TradeMetricResultLabel) => tradeMetricResultLabels[label] ?? label

export const translatePeriodTagCategory = (category: PeriodTagCategory) => periodTagCategoryLabels[category] ?? category

export const translatePeriodTagSource = (source: PeriodTagSource) => periodTagSourceLabels[source] ?? source

export const translateFeedbackType = (type: FeedbackItem['type']) => feedbackTypeLabels[type] ?? type

export const translateFeedbackPriority = (priority: FeedbackItem['priority']) => feedbackPriorityLabels[priority] ?? priority

export const translateRuleSeverity = (severity: RuleRollupEntry['severity']) => ruleSeverityLabels[severity] ?? severity

export const translateCalibrationStatus = (status: 'ok' | 'sparse' | 'pending') => calibrationStatusLabels[status] ?? status

export const translateSessionDisplayTitle = (title: string) => translateLegacySessionTitle(title)

export const translateSessionDisplayContext = (value: string) => translateLegacyContextFocus(value)

export const translateTargetOptionLabel = (value: string) => translateSessionDisplayTitle(value)

export const translateTargetOptionSubtitle = (value: string) => translatePeriodLabel(replaceTargetSubtitleTerms(value))

export const translateCurrentTargetLabel = (option: CurrentTargetOption | null) =>
  option ? translateTargetOptionLabel(option.label) : '工作过程'
