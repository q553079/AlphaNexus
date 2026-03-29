import { useEffect, useMemo, useState } from 'react'
import type { AiRunExecutionResult, AiAnalysisAttachment } from '@shared/ai/contracts'
import { SectionCard } from '@app/components/SectionCard'
import { AnnotationMetadataEditor } from '@app/features/annotation/AnnotationMetadataEditor'
import type { DraftAnnotation, PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import { AnchorAnnotationInspector } from '@app/features/anchors'
import type { AnnotationInspectorItem } from '@app/features/anchors'
import { CapturePanel } from '@app/features/capture/CapturePanel'
import { AnnotationSuggestionsPanel } from '@app/features/suggestions'
import type { AnnotationSuggestionView } from '@app/features/suggestions'
import {
  translateAnnotationSemantic,
  translateAnnotationShape,
  translateContextType,
} from '@app/ui/display-text'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { EventRecord } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import type { CurrentTargetOption, CurrentTargetOptionsPayload, SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { SessionCanvasAnalysisTray } from './SessionCanvasAnalysisTray'
import { SessionCanvasFilmstrip } from './SessionCanvasFilmstrip'
import { SessionCanvasStage } from './SessionCanvasStage'
import { SessionScreenshotCard } from './SessionScreenshotCard'
import { SessionStoryStack } from './SessionStoryStack'
import type { AnalysisTrayState, ScreenshotStageViewMode } from './session-workbench-types'
import type { ScreenshotAiReplyRecord } from './modules/session-screenshot-ai-thread'
import type { ScreenshotGalleryState } from './modules/session-screenshot-gallery'

type SessionCanvasColumnProps = {
  activeContentBlocks: ContentBlockRecord[]
  analysisTray: AnalysisTrayState
  analysisTrayCompareScreenshot: ScreenshotRecord | null
  analysisTrayPrimaryScreenshot: ScreenshotRecord | null
  analysisTrayScreenshots: ScreenshotRecord[]
  adoptedAnnotationKeys: Set<string>
  activeAnnotations: AnnotationRecord[]
  annotationInspectorItems: AnnotationInspectorItem[]
  annotationSuggestions: AnnotationSuggestionView[]
  busy: boolean
  currentTrade: TradeRecord | null
  deletedAnnotations: AnnotationRecord[]
  deletedContentBlocks: ContentBlockRecord[]
  deletedScreenshots: ScreenshotRecord[]
  draftAnnotations: DraftAnnotation[]
  onAddScreenshotToAnalysisTray: (screenshotId: string) => void
  onClearAnalysisTray: () => void
  onCreateNoteBlock: (input: {
    event_id: string
    title?: string
    content_md?: string
  }) => Promise<ContentBlockRecord | null>
  onAdoptAnchor: (item: AnnotationInspectorItem) => void
  onAnnotationSuggestionAction: (suggestionId: string, action: 'keep' | 'merge' | 'discard') => void
  onDeleteAiRecord: (aiRunId: string) => void
  onDeleteAnnotation: (annotationId: string) => void
  onDeleteBlock: (block: ContentBlockRecord) => void
  onMoveContentBlock: (block: ContentBlockRecord, option: CurrentTargetOption) => void
  onMoveScreenshot: (screenshot: ScreenshotRecord, option: CurrentTargetOption) => void
  onDeleteScreenshot: (screenshotId: string) => void
  onDraftAnnotationsChange: (annotations: DraftAnnotation[]) => void
  onImportScreenshot: () => void
  onMoveAnalysisTrayScreenshot: (screenshotId: string, direction: 'backward' | 'forward') => void
  onOpenAiComposer: (input?: {
    primaryScreenshotId?: string | null
  }) => void
  onQuickSendToAi: (screenshotId?: string | null) => Promise<void>
  onRemoveScreenshotFromAnalysisTray: (screenshotId: string) => void
  onRunAnalysisForScreenshot: (screenshotId: string) => Promise<AiRunExecutionResult | null>
  onRunAnalysisFollowUpForScreenshot: (input: {
    attachments?: AiAnalysisAttachment[]
    backgroundNoteMd: string
    screenshotId: string
  }) => Promise<AiRunExecutionResult | null>
  onSetCompareAnalysisTrayScreenshot: (screenshotId: string | null) => void
  onSetScreenshotStageViewMode: (mode: ScreenshotStageViewMode) => void
  onSnipScreenshot: () => void
  onRestoreAnnotation: (annotationId: string) => void
  onRestoreBlock: (block: ContentBlockRecord) => void
  onRestoreScreenshot: (screenshotId: string) => void
  onSaveAnnotations: () => void
  onSetPrimaryAnalysisTrayScreenshot: (screenshotId: string) => void
  onUpdateAnnotation: (input: {
    annotation_id: string
    label: string
    title: string
    semantic_type: AnnotationRecord['semantic_type']
    text: string | null
    note_md: string
    add_to_memory: boolean
  }) => void
  onUpdateNoteBlock: (input: {
    block_id: string
    title: string
    content_md: string
  }) => Promise<ContentBlockRecord | null>
  moveTargetOptions: CurrentTargetOptionsPayload | null
  onSelectScreenshot: (screenshotId: string) => void
  payload: SessionWorkbenchPayload
  screenshotGallery: ScreenshotGalleryState
  screenshotStageViewMode: ScreenshotStageViewMode
  selectedEvent: EventRecord | null
  selectedScreenshot: ScreenshotRecord | null
}

const buildScreenshotTargetPayload = (targetPayload: CurrentTargetOptionsPayload | null) => {
  if (!targetPayload) {
    return null
  }

  const options = targetPayload.options.filter((option) => option.target_kind !== 'period')
  return {
    current_context: targetPayload.current_context,
    options,
    groups: {
      current: targetPayload.groups.current.filter((option) => option.target_kind !== 'period'),
      recent: targetPayload.groups.recent.filter((option) => option.target_kind !== 'period'),
      history: targetPayload.groups.history.filter((option) => option.target_kind !== 'period'),
      previous_period_trades: targetPayload.groups.previous_period_trades,
    },
  }
}

const resolveEventScopedNoteBlock = (
  blocks: ContentBlockRecord[],
  eventId: string | null | undefined,
) => {
  if (!eventId) {
    return null
  }

  return blocks
    .filter((block) => !block.soft_deleted && block.block_type === 'markdown' && block.event_id === eventId)
    .sort((left, right) => left.sort_order - right.sort_order || left.created_at.localeCompare(right.created_at))[0] ?? null
}

const resolveScreenshotAiReply = (
  payload: SessionWorkbenchPayload,
  screenshot: ScreenshotRecord,
): ScreenshotAiReplyRecord[] => (
  [...payload.events]
    .filter((event) => event.event_type === 'ai_summary' && event.screenshot_id === screenshot.id && event.ai_run_id)
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at))
    .map((event) => {
      const card = event.ai_run_id
        ? payload.analysis_cards.find((item) => item.ai_run_id === event.ai_run_id) ?? null
        : null
      if (!card) {
        return null
      }
      return {
        aiEvent: event,
        aiRun: event.ai_run_id ? payload.ai_runs.find((run) => run.id === event.ai_run_id) ?? null : null,
        card,
      }
    })
    .filter((item): item is ScreenshotAiReplyRecord => item != null)
)

export const SessionCanvasColumn = ({
  activeContentBlocks,
  analysisTray,
  analysisTrayCompareScreenshot,
  analysisTrayPrimaryScreenshot,
  analysisTrayScreenshots,
  adoptedAnnotationKeys,
  activeAnnotations,
  annotationInspectorItems,
  annotationSuggestions,
  busy,
  currentTrade,
  deletedAnnotations,
  deletedContentBlocks,
  deletedScreenshots,
  draftAnnotations,
  onAddScreenshotToAnalysisTray,
  onClearAnalysisTray,
  onAdoptAnchor,
  onAnnotationSuggestionAction,
  onDeleteAnnotation,
  onDeleteBlock,
  onMoveContentBlock,
  onMoveScreenshot,
  onDeleteScreenshot,
  onDraftAnnotationsChange,
  onImportScreenshot,
  onMoveAnalysisTrayScreenshot,
  onOpenAiComposer,
  onQuickSendToAi,
  onRemoveScreenshotFromAnalysisTray,
  onRunAnalysisForScreenshot,
  onRunAnalysisFollowUpForScreenshot,
  onSetCompareAnalysisTrayScreenshot,
  onSetScreenshotStageViewMode,
  onSnipScreenshot,
  onRestoreAnnotation,
  onRestoreBlock,
  onRestoreScreenshot,
  onSaveAnnotations,
  onSetPrimaryAnalysisTrayScreenshot,
  onUpdateAnnotation,
  onCreateNoteBlock,
  onUpdateNoteBlock,
  onDeleteAiRecord,
  moveTargetOptions,
  onSelectScreenshot,
  payload,
  screenshotGallery,
  screenshotStageViewMode,
  selectedEvent,
  selectedScreenshot,
}: SessionCanvasColumnProps) => {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const screenshotTargetPayload = buildScreenshotTargetPayload(moveTargetOptions)
  const stagePrimaryScreenshot = selectedScreenshot ?? analysisTrayPrimaryScreenshot ?? screenshotGallery.screenshots[0] ?? null
  const stageEvent = stagePrimaryScreenshot
    ? payload.events.find((event) => event.id === stagePrimaryScreenshot.event_id)
      ?? payload.events.find((event) => event.screenshot_id === stagePrimaryScreenshot.id)
      ?? null
    : selectedEvent
  const compareScreenshot = analysisTrayCompareScreenshot
    ?? (() => {
      if (!stagePrimaryScreenshot || !screenshotGallery.compare_pair) {
        return null
      }
      const { setup, exit } = screenshotGallery.compare_pair
      if (setup && stagePrimaryScreenshot.id !== setup.id) {
        return setup
      }
      if (exit && stagePrimaryScreenshot.id !== exit.id) {
        return exit
      }
      return null
    })()
  const selectedScreenshotTargetOption = screenshotTargetPayload?.options.find((option) => {
    if (screenshotGallery.target_trade_id) {
      return option.target_kind === 'trade' && option.trade_id === screenshotGallery.target_trade_id
    }

    return option.target_kind === 'session' && option.session_id === screenshotGallery.target_session_id
  }) ?? null
  const candidateAnnotations = useMemo<PendingDraftAnnotation[]>(
    () => annotationSuggestions.map((suggestion) => ({
      shape: suggestion.shape,
      label: suggestion.label,
      title: suggestion.title ?? suggestion.label,
      semantic_type: suggestion.semantic_type as PendingDraftAnnotation['semantic_type'],
      color: suggestion.color,
      x1: suggestion.x1,
      y1: suggestion.y1,
      x2: suggestion.x2,
      y2: suggestion.y2,
      text: suggestion.text ?? null,
      note_md: suggestion.reason_summary,
      add_to_memory: false,
      stroke_width: 2,
    })),
    [annotationSuggestions],
  )
  const stageScreenshotIndex = stagePrimaryScreenshot
    ? screenshotGallery.screenshots.findIndex((screenshot) => screenshot.id === stagePrimaryScreenshot.id)
    : -1
  const noteBlock = resolveEventScopedNoteBlock(activeContentBlocks, stageEvent?.id ?? stagePrimaryScreenshot?.event_id)
  const aiReplies = stagePrimaryScreenshot ? resolveScreenshotAiReply(payload, stagePrimaryScreenshot) : []
  const selectedAnnotation = activeAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ?? activeAnnotations[0] ?? null
  const hasAnnotationMaintenance = annotationInspectorItems.length > 0
    || activeAnnotations.length > 0
    || deletedAnnotations.length > 0
    || deletedScreenshots.length > 0
    || deletedContentBlocks.length > 0

  useEffect(() => {
    setSelectedAnnotationId((current) =>
      current && activeAnnotations.some((annotation) => annotation.id === current)
        ? current
        : activeAnnotations[0]?.id ?? null)
  }, [activeAnnotations])

  return (
    <section className="session-workbench__column session-workbench__column--canvas">
      <SectionCard title="证据画布" subtitle="中间列现在围绕主舞台、胶片流和 analysis tray 展开，不再把截图按顺序长堆叠。">
        <CapturePanel
          annotations={draftAnnotations}
          busy={busy}
          onImport={onImportScreenshot}
          onSave={onSaveAnnotations}
          onSnip={onSnipScreenshot}
          screenshot={selectedScreenshot}
          showSaveButton={false}
        />

        <div className="session-workbench__ai-packet-bar">
          <div className="session-workbench__ai-packet-meta">
            <strong>AI 发包</strong>
            <p>
              当前主图：{stagePrimaryScreenshot?.caption ?? stagePrimaryScreenshot?.id ?? '未选择'} ·
              托盘附图 {analysisTray.screenshotIds.length}
            </p>
          </div>
          <div className="action-row">
            <button
              className="button is-secondary"
              disabled={busy || !stagePrimaryScreenshot}
              onClick={() => {
                void onQuickSendToAi(stagePrimaryScreenshot?.id ?? null)
              }}
              type="button"
            >
              快速发送
            </button>
            <button
              className="button is-primary"
              disabled={busy}
              onClick={() => onOpenAiComposer({
                primaryScreenshotId: stagePrimaryScreenshot?.id ?? null,
              })}
              type="button"
            >
              编辑后发送
            </button>
          </div>
        </div>

        <SessionCanvasStage
          analysisTray={analysisTray}
          compareScreenshot={compareScreenshot}
          primaryScreenshot={stagePrimaryScreenshot}
          scopeLabel={screenshotGallery.scope_label}
          trayScreenshots={analysisTrayScreenshots}
          viewMode={screenshotStageViewMode}
          onAddPrimaryToTray={onAddScreenshotToAnalysisTray}
          onOpenAiComposer={onOpenAiComposer}
          onQuickSendToAi={onQuickSendToAi}
          onSelectScreenshot={onSelectScreenshot}
          onSetCompareScreenshot={onSetCompareAnalysisTrayScreenshot}
          onSetPrimaryAnalysisTrayScreenshot={onSetPrimaryAnalysisTrayScreenshot}
          onSetViewMode={onSetScreenshotStageViewMode}
        />

        <SessionCanvasFilmstrip
          selectedScreenshotId={stagePrimaryScreenshot?.id ?? null}
          screenshots={screenshotGallery.screenshots}
          trayPrimaryScreenshotId={analysisTray.primaryScreenshotId}
          trayScreenshotIds={analysisTray.screenshotIds}
          onAddToTray={onAddScreenshotToAnalysisTray}
          onSelectScreenshot={onSelectScreenshot}
        />

        <SessionCanvasAnalysisTray
          compareScreenshotId={analysisTray.compareScreenshotId}
          primaryScreenshotId={analysisTray.primaryScreenshotId}
          screenshots={analysisTrayScreenshots}
          onClear={onClearAnalysisTray}
          onMove={onMoveAnalysisTrayScreenshot}
          onOpenComposer={() => onOpenAiComposer({
            primaryScreenshotId: stagePrimaryScreenshot?.id ?? analysisTray.primaryScreenshotId ?? null,
          })}
          onRemove={onRemoveScreenshotFromAnalysisTray}
          onSelectScreenshot={onSelectScreenshot}
          onSetCompare={onSetCompareAnalysisTrayScreenshot}
          onSetPrimary={onSetPrimaryAnalysisTrayScreenshot}
        />

        {stagePrimaryScreenshot ? (
          <section className="session-workbench__canvas-detail">
            <div className="session-workbench__canvas-detail-header">
              <div>
                <strong>当前图详情与编辑</strong>
                <p>主舞台负责大图浏览，这里保留标注、笔记、挂载调整和 AI 跟进，不再重复渲染主图。</p>
              </div>
              <span className="status-pill">Detail Panel</span>
            </div>
            <SessionScreenshotCard
              aiReplies={aiReplies}
              busy={busy}
              candidateAnnotations={candidateAnnotations}
              draftAnnotations={draftAnnotations}
              index={Math.max(stageScreenshotIndex, 0)}
              inAnalysisTray={analysisTray.screenshotIds.includes(stagePrimaryScreenshot.id)}
              isSelected
              isTrayPrimary={analysisTray.primaryScreenshotId === stagePrimaryScreenshot.id}
              noteBlock={noteBlock}
              onAddToAnalysisTray={onAddScreenshotToAnalysisTray}
              onCreateNoteBlock={onCreateNoteBlock}
              onDeleteAiRecord={onDeleteAiRecord}
              onDeleteScreenshot={onDeleteScreenshot}
              onDraftAnnotationsChange={onDraftAnnotationsChange}
              onMoveScreenshot={onMoveScreenshot}
              onOpenAiComposer={(screenshotId) => onOpenAiComposer({
                primaryScreenshotId: screenshotId,
              })}
              onQuickSendToAi={onQuickSendToAi}
              onRunAnalysisForScreenshot={onRunAnalysisForScreenshot}
              onRunAnalysisFollowUpForScreenshot={onRunAnalysisFollowUpForScreenshot}
              onSaveAnnotations={onSaveAnnotations}
              onSelectScreenshot={onSelectScreenshot}
              onSetPrimaryAnalysisTrayScreenshot={onSetPrimaryAnalysisTrayScreenshot}
              onUpdateNoteBlock={onUpdateNoteBlock}
              presentation="detail"
              screenshot={stagePrimaryScreenshot}
              screenshotTargetOption={selectedScreenshotTargetOption}
              screenshotTargetPayload={screenshotTargetPayload}
              selectedEvent={stageEvent}
            />
          </section>
        ) : (
          <div className="session-workbench__canvas-empty">先在左侧选中一个事件或截图，再开始画图和整理这一段证据流。</div>
        )}

        {annotationSuggestions.length > 0 ? (
          <div className="session-workbench__suggestion-layer">
            <AnnotationSuggestionsPanel
              busy={busy}
              suggestions={annotationSuggestions}
              onDiscard={(suggestionId) => onAnnotationSuggestionAction(suggestionId, 'discard')}
              onKeep={(suggestionId) => onAnnotationSuggestionAction(suggestionId, 'keep')}
              onMerge={(suggestionId) => onAnnotationSuggestionAction(suggestionId, 'merge')}
            />
          </div>
        ) : null}

        <SessionStoryStack
          activeContentBlocks={activeContentBlocks}
          busy={busy}
          currentTrade={currentTrade}
          moveTargetOptions={moveTargetOptions}
          onDeleteBlock={onDeleteBlock}
          onMoveContentBlock={onMoveContentBlock}
          payload={payload}
          selectedEvent={stageEvent}
          selectedScreenshot={stagePrimaryScreenshot}
        />
      </SectionCard>

      {hasAnnotationMaintenance ? (
        <SectionCard title="图上标注（按需展开）" subtitle="平时在主图上处理；只有要深改标注信息或恢复删除内容时再展开。">
          <details className="session-workbench__annotation-drawer">
            <summary className="session-workbench__annotation-drawer-summary">
              <div>
                <strong>已保存标注 {activeAnnotations.length} 条</strong>
                <p>需要深改标注信息或恢复删除内容时，再打开这里。</p>
              </div>
              <span className="status-pill">按需展开</span>
            </summary>

            {annotationInspectorItems.length > 0 ? (
              <div className="session-workbench__anchor-adopt">
                <p className="session-workbench__deleted-label">可升级为记忆 / Anchor 的标注</p>
                <AnchorAnnotationInspector
                  adoptedKeys={adoptedAnnotationKeys}
                  busy={busy}
                  items={annotationInspectorItems}
                  onAdopt={onAdoptAnchor}
                />
              </div>
            ) : null}
            <div className="session-workbench__content-blocks">
              {activeAnnotations.length > 0 ? (
                activeAnnotations.map((annotation) => (
                  <article
                    className={`session-workbench__content-block ${selectedAnnotation?.id === annotation.id ? 'is-selected' : ''}`.trim()}
                    key={annotation.id}
                  >
                    <div className="session-workbench__content-header">
                      <div>
                        <h3>{annotation.title}</h3>
                        <p className="session-workbench__content-meta">
                          {annotation.label} · {translateAnnotationShape(annotation.shape)} · {translateAnnotationSemantic(annotation.semantic_type)}
                        </p>
                      </div>
                      <button className="button is-secondary" disabled={busy} onClick={() => setSelectedAnnotationId(annotation.id)} type="button">
                        编辑
                      </button>
                    </div>
                    {annotation.note_md ? <p className="workbench-text">{annotation.note_md}</p> : null}
                    <div className="action-row">
                      {annotation.add_to_memory ? <span className="status-pill">记忆候选</span> : null}
                      <span className="status-pill">{annotation.color}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-state">当前截图还没有已保存标注。</p>
              )}
              {selectedAnnotation ? (
                <AnnotationMetadataEditor
                  annotation={selectedAnnotation}
                  busy={busy}
                  onDelete={onDeleteAnnotation}
                  onSave={onUpdateAnnotation}
                />
              ) : null}
              {deletedAnnotations.length > 0 ? (
                <div className="session-workbench__deleted-group">
                  <p className="session-workbench__deleted-label">已删除标注</p>
                  {deletedAnnotations.map((annotation) => (
                    <article className="session-workbench__content-block is-deleted" key={annotation.id}>
                      <div className="session-workbench__content-header">
                        <div>
                          <h3>{annotation.label}</h3>
                          <p className="session-workbench__content-meta">软删除</p>
                        </div>
                        <button className="button is-secondary" disabled={busy} onClick={() => onRestoreAnnotation(annotation.id)} type="button">
                          恢复
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              {deletedScreenshots.length > 0 ? (
                <div className="session-workbench__deleted-group">
                  <p className="session-workbench__deleted-label">已删除截图</p>
                  {deletedScreenshots.map((screenshot) => (
                    <article className="session-workbench__content-block is-deleted" key={screenshot.id}>
                      <div className="session-workbench__content-header">
                        <div>
                          <h3>{screenshot.caption ?? screenshot.id}</h3>
                          <p className="session-workbench__content-meta">已软删除，可恢复</p>
                        </div>
                        <button className="button is-secondary" disabled={busy} onClick={() => onRestoreScreenshot(screenshot.id)} type="button">
                          恢复
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="session-workbench__content-blocks">
              {deletedContentBlocks.length > 0 ? (
                <div className="session-workbench__deleted-group">
                  <p className="session-workbench__deleted-label">已删除笔记</p>
                  {deletedContentBlocks.map((block) => (
                    <article className="session-workbench__content-block is-deleted" key={block.id}>
                      <div className="session-workbench__content-header">
                        <div>
                          <h3>{block.title}</h3>
                          <p className="session-workbench__content-meta">{translateContextType(block.context_type)} · 软删除</p>
                        </div>
                        <button className="button is-secondary" disabled={busy} onClick={() => onRestoreBlock(block)} type="button">
                          恢复
                        </button>
                      </div>
                      <p className="workbench-text">{block.content_md}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        </SectionCard>
      ) : null}
    </section>
  )
}
