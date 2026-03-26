import type { AnalysisCardRecord } from '@shared/contracts/analysis'
import type { ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { SessionBucket } from '@shared/contracts/launcher'
import type { SessionRecord } from '@shared/contracts/session'
import type { TradeRecord } from '@shared/contracts/trade'

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
}

const eventTypeLabels: Record<EventRecord['event_type'], string> = {
  observation: '观察',
  thesis: '观点',
  trade_open: '开仓',
  trade_close: '平仓',
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
  session: 'Session',
  event: '事件',
  trade: '交易',
}

const annotationShapeLabels: Record<AnnotationShape, string> = {
  rectangle: '矩形',
  ellipse: '圆形',
  line: '线段',
  arrow: '箭头',
  text: '文本',
}

const sessionBucketLabels: Record<SessionBucket, string> = {
  am: '上午',
  pm: '下午',
  night: '夜盘',
  custom: '自定义',
}

export const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value))

export const formatTime = (value: string) => timeFormatter.format(new Date(value))

export const translateSessionStatus = (status: SessionRecord['status']) => sessionStatusLabels[status] ?? status

export const translateMarketBias = (bias: SessionRecord['market_bias']) => marketBiasLabels[bias] ?? bias

export const translateAnalysisBias = (bias: AnalysisCardRecord['bias']) => marketBiasLabels[bias] ?? bias

export const translateTradeSide = (side: TradeRecord['side']) => tradeSideLabels[side] ?? side

export const translateTradeStatus = (status: TradeRecord['status']) => tradeStatusLabels[status] ?? status

export const translateEventType = (eventType: EventRecord['event_type']) => eventTypeLabels[eventType] ?? eventType

export const translateCaptureKind = (kind: CaptureKind) => captureKindLabels[kind] ?? kind

export const translateContextType = (contextType: ContentBlockRecord['context_type']) => contextTypeLabels[contextType] ?? contextType

export const translateAnnotationShape = (shape: AnnotationShape) => annotationShapeLabels[shape] ?? shape

export const translateSessionBucket = (bucket: SessionBucket) => sessionBucketLabels[bucket] ?? bucket
