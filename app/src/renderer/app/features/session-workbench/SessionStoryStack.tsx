import { ContentBlockTargetManager } from '@app/features/context/ContentBlockTargetManager'
import {
  formatDateTime,
  translateAnalysisBias,
  translateContextType,
  translateEventType,
} from '@app/ui/display-text'
import type { ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import type { SessionWorkbenchPayload, CurrentTargetOptionsPayload, CurrentTargetOption } from '@shared/contracts/workbench'

type SessionStoryStackProps = {
  activeContentBlocks: ContentBlockRecord[]
  busy: boolean
  moveTargetOptions: CurrentTargetOptionsPayload | null
  onDeleteBlock: (block: ContentBlockRecord) => void
  onMoveContentBlock: (block: ContentBlockRecord, option: CurrentTargetOption) => void
  payload: SessionWorkbenchPayload
  selectedEvent: EventRecord | null
  selectedScreenshot: ScreenshotRecord | null
  currentTrade: TradeRecord | null
}

const resolveRealtimeLabel = (title: string) => (title === 'Realtime view' ? '我的看法' : title)

const buildRelatedNotes = (
  payload: SessionWorkbenchPayload,
  activeContentBlocks: ContentBlockRecord[],
  selectedEvent: EventRecord | null,
) => {
  const currentContextType = payload.current_context.trade_id ? 'trade' : 'session'
  const currentContextId = payload.current_context.trade_id ?? payload.session.id
  const selectedBlockIds = new Set(selectedEvent?.content_block_ids ?? [])

  const uniqueBlocks = new Map<string, ContentBlockRecord>()

  for (const block of activeContentBlocks) {
    if (block.block_type === 'ai-summary') {
      continue
    }

    const isSelectedEventBlock = selectedEvent != null
      && (selectedBlockIds.has(block.id) || block.event_id === selectedEvent.id)
    const isCurrentContextBlock = block.context_type === currentContextType && block.context_id === currentContextId

    if (isSelectedEventBlock || isCurrentContextBlock) {
      uniqueBlocks.set(block.id, block)
    }
  }

  return [...uniqueBlocks.values()].sort((left, right) =>
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
}

const resolveRelatedAnalysis = (
  payload: SessionWorkbenchPayload,
  selectedEvent: EventRecord | null,
  selectedScreenshot: ScreenshotRecord | null,
  currentTrade: TradeRecord | null,
) => {
  const directAiEvent = selectedEvent?.ai_run_id
    ? payload.events.find((event) => event.id === selectedEvent.id) ?? null
    : null
  const screenshotAiEvent = selectedScreenshot
    ? [...payload.events]
      .filter((event) => event.event_type === 'ai_summary' && event.screenshot_id === selectedScreenshot.id && event.ai_run_id)
      .sort((left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime())
      .at(-1) ?? null
    : null
  const tradeAiEvent = currentTrade
    ? [...payload.events]
      .filter((event) => event.event_type === 'ai_summary' && event.trade_id === currentTrade.id && event.ai_run_id)
      .sort((left, right) => new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime())
      .at(-1) ?? null
    : null

  const aiEvent = directAiEvent ?? screenshotAiEvent ?? tradeAiEvent
  if (!aiEvent?.ai_run_id) {
    return null
  }

  const aiRun = payload.ai_runs.find((run) => run.id === aiEvent.ai_run_id) ?? null
  const card = payload.analysis_cards.find((item) => item.ai_run_id === aiEvent.ai_run_id) ?? null

  if (!card) {
    return null
  }

  return {
    aiEvent,
    aiRun,
    card,
  }
}

export const SessionStoryStack = ({
  activeContentBlocks,
  busy,
  moveTargetOptions,
  onDeleteBlock,
  onMoveContentBlock,
  payload,
  selectedEvent,
  selectedScreenshot,
  currentTrade,
}: SessionStoryStackProps) => {
  const relatedNotes = buildRelatedNotes(payload, activeContentBlocks, selectedEvent)
  const relatedAnalysis = resolveRelatedAnalysis(payload, selectedEvent, selectedScreenshot, currentTrade)
  const hasStory = selectedEvent || relatedAnalysis || relatedNotes.length > 0

  if (!hasStory) {
    return (
      <div className="empty-state">
        当前这段事件流还没有沉淀出已确认的 AI 回复或笔记。
      </div>
    )
  }

  return (
    <div className="session-story-stack">
      <p className="session-workbench__deleted-label">顺着事件流往下看</p>

      {selectedEvent ? (
        <details className="session-story-stack__item" open>
          <summary className="session-story-stack__summary">
            <div>
              <strong>当前事件</strong>
              <p>{translateEventType(selectedEvent.event_type)} · {formatDateTime(selectedEvent.occurred_at)}</p>
            </div>
            <span className="status-pill">{selectedEvent.title}</span>
          </summary>
          <div className="session-story-stack__body">
            <p className="workbench-text">{selectedEvent.summary || '当前事件还没有补充摘要。'}</p>
          </div>
        </details>
      ) : null}

      {relatedAnalysis ? (
        <details className="session-story-stack__item" open>
          <summary className="session-story-stack__summary">
            <div>
              <strong>已确认 AI 回复</strong>
              <p>{formatDateTime(relatedAnalysis.aiEvent.occurred_at)} · {relatedAnalysis.aiRun?.provider ?? 'AI'}</p>
            </div>
            <span className="status-pill">按需展开</span>
          </summary>
          <div className="session-story-stack__body">
            <div className="session-story-stack__analysis">
              <div className="session-story-stack__analysis-pills">
                <span className="status-pill">{translateAnalysisBias(relatedAnalysis.card.bias)}</span>
                <span className="status-pill">置信度 {relatedAnalysis.card.confidence_pct}%</span>
                <span className="status-pill">反转概率 {relatedAnalysis.card.reversal_probability_pct}%</span>
              </div>
              <p className="workbench-text">{relatedAnalysis.card.summary_short}</p>
              <dl className="session-story-stack__analysis-grid">
                <div>
                  <dt>入场区间</dt>
                  <dd>{relatedAnalysis.card.entry_zone}</dd>
                </div>
                <div>
                  <dt>止损</dt>
                  <dd>{relatedAnalysis.card.stop_loss}</dd>
                </div>
                <div>
                  <dt>止盈目标</dt>
                  <dd>{relatedAnalysis.card.take_profit}</dd>
                </div>
                <div>
                  <dt>失效条件</dt>
                  <dd>{relatedAnalysis.card.invalidation}</dd>
                </div>
              </dl>
              {relatedAnalysis.card.supporting_factors.length > 0 ? (
                <details className="session-story-stack__analysis-detail">
                  <summary>支撑因素</summary>
                  <ul>
                    {relatedAnalysis.card.supporting_factors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {relatedAnalysis.card.deep_analysis_md.trim() ? (
                <details className="session-story-stack__analysis-detail">
                  <summary>完整回复</summary>
                  <pre>{relatedAnalysis.card.deep_analysis_md}</pre>
                </details>
              ) : null}
            </div>
          </div>
        </details>
      ) : null}

      {relatedNotes.map((block) => (
        <details className="session-story-stack__item" key={block.id} open>
          <summary className="session-story-stack__summary">
            <div>
              <strong>{resolveRealtimeLabel(block.title)}</strong>
              <p>{translateContextType(block.context_type)} · {formatDateTime(block.created_at)}</p>
            </div>
            <span className="status-pill">展开编辑</span>
          </summary>
          <div className="session-story-stack__body">
            <p className="workbench-text">{block.content_md || '这条记录还没有正文。'}</p>
            <div className="action-row">
              <button className="button is-ghost" disabled={busy} onClick={() => onDeleteBlock(block)} type="button">
                删除
              </button>
            </div>
            <ContentBlockTargetManager
              block={block}
              busy={busy}
              onMove={onMoveContentBlock}
              targetPayload={moveTargetOptions}
            />
          </div>
        </details>
      ))}
    </div>
  )
}
