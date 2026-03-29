import { useEffect, useMemo, useState } from 'react'
import type { AiRunExecutionResult, AiAnalysisAttachment } from '@shared/ai/contracts'
import { SectionCard } from '@app/components/SectionCard'
import { LazyImage } from '@app/components/LazyImage'
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
import { SessionImageLightbox } from './SessionImageLightbox'
import { SessionScreenshotCard } from './SessionScreenshotCard'
import { SessionStoryStack } from './SessionStoryStack'
import type { ScreenshotAiReplyRecord } from './modules/session-screenshot-ai-thread'
import type { ScreenshotGalleryState } from './modules/session-screenshot-gallery'

type SessionCanvasColumnProps = {
  activeContentBlocks: ContentBlockRecord[]
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
  onRunAnalysisForScreenshot: (screenshotId: string) => Promise<AiRunExecutionResult | null>
  onRunAnalysisFollowUpForScreenshot: (input: {
    attachments?: AiAnalysisAttachment[]
    backgroundNoteMd: string
    screenshotId: string
  }) => Promise<AiRunExecutionResult | null>
  onSnipScreenshot: () => void
  onRestoreAnnotation: (annotationId: string) => void
  onRestoreBlock: (block: ContentBlockRecord) => void
  onRestoreScreenshot: (screenshotId: string) => void
  onSaveAnnotations: () => void
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

const resolveScreenshotPreviewAsset = (screenshot: ScreenshotRecord) =>
  screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url

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
  onAdoptAnchor,
  onAnnotationSuggestionAction,
  onDeleteAnnotation,
  onDeleteBlock,
  onMoveContentBlock,
  onMoveScreenshot,
  onDeleteScreenshot,
  onDraftAnnotationsChange,
  onImportScreenshot,
  onRunAnalysisForScreenshot,
  onRunAnalysisFollowUpForScreenshot,
  onSnipScreenshot,
  onRestoreAnnotation,
  onRestoreBlock,
  onRestoreScreenshot,
  onSaveAnnotations,
  onUpdateAnnotation,
  onCreateNoteBlock,
  onUpdateNoteBlock,
  onDeleteAiRecord,
  moveTargetOptions,
  onSelectScreenshot,
  payload,
  screenshotGallery,
  selectedEvent,
  selectedScreenshot,
}: SessionCanvasColumnProps) => {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<{
    alt: string
    src: string | null
    title: string
  } | null>(null)
  const screenshotTargetPayload = buildScreenshotTargetPayload(moveTargetOptions)
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
      <SectionCard title="绘图工作区" subtitle="事件流里的图会顺着往下排，点到哪张就在那张图上继续画。">
        <CapturePanel
          annotations={draftAnnotations}
          busy={busy}
          onImport={onImportScreenshot}
          onSave={onSaveAnnotations}
          onSnip={onSnipScreenshot}
          screenshot={selectedScreenshot}
          showSaveButton={false}
        />
        {screenshotGallery.screenshots.length > 0 ? (
          <div className="session-workbench__media-stack">
            {screenshotGallery.screenshots.map((screenshot, index) => {
              const isSelected = selectedScreenshot?.id === screenshot.id
              const screenshotEvent = payload.events.find((event) => event.id === screenshot.event_id)
                ?? payload.events.find((event) => event.screenshot_id === screenshot.id)
                ?? null
              const noteBlock = resolveEventScopedNoteBlock(activeContentBlocks, screenshotEvent?.id ?? screenshot.event_id)
              const aiReplies = resolveScreenshotAiReply(payload, screenshot)
              return (
                <SessionScreenshotCard
                  aiReplies={aiReplies}
                  busy={busy}
                  candidateAnnotations={candidateAnnotations}
                  draftAnnotations={draftAnnotations}
                  index={index}
                  key={screenshot.id}
                  isSelected={isSelected}
                  noteBlock={noteBlock}
                  onCreateNoteBlock={onCreateNoteBlock}
                  onDeleteAiRecord={onDeleteAiRecord}
                  onDeleteScreenshot={onDeleteScreenshot}
                  onDraftAnnotationsChange={onDraftAnnotationsChange}
                  onMoveScreenshot={onMoveScreenshot}
                  onRunAnalysisForScreenshot={onRunAnalysisForScreenshot}
                  onRunAnalysisFollowUpForScreenshot={onRunAnalysisFollowUpForScreenshot}
                  onSaveAnnotations={onSaveAnnotations}
                  onSelectScreenshot={onSelectScreenshot}
                  onUpdateNoteBlock={onUpdateNoteBlock}
                  screenshot={screenshot}
                  screenshotTargetOption={selectedScreenshotTargetOption}
                  screenshotTargetPayload={screenshotTargetPayload}
                  selectedEvent={screenshotEvent}
                />
              )
            })}
          </div>
        ) : (
          <div className="session-workbench__canvas-empty">先在左侧选中一个事件或截图，再开始画图和整理这一段事件流。</div>
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
        {screenshotGallery.compare_pair?.setup && screenshotGallery.compare_pair.exit ? (
          <div className="session-workbench__content-blocks">
            <p className="session-workbench__deleted-label">开仓图 / 离场图基础对照</p>
            <div className="trade-thread-media">
              {[{
                title: '开仓图',
                screenshot: screenshotGallery.compare_pair.setup,
              }, {
                title: '离场图',
                screenshot: screenshotGallery.compare_pair.exit,
              }].map((item) => (
                <article className="trade-thread-media__stage" key={item.title}>
                  <div className="trade-thread-media__meta">
                    <div>
                      <p className="trade-thread-media__eyebrow">{item.title}</p>
                      <h3>{item.screenshot.caption ?? `${item.title} 图`}</h3>
                      <p>{item.screenshot.created_at}</p>
                    </div>
                  </div>
                  <div className="trade-thread-media__hero">
                    <button
                      className="session-workbench__image-button"
                      onClick={() => setLightboxImage({
                        alt: item.screenshot.caption ?? item.title,
                        src: resolveScreenshotPreviewAsset(item.screenshot),
                        title: item.screenshot.caption ?? `${item.title} 图`,
                      })}
                      type="button"
                    >
                      <LazyImage
                        alt={item.screenshot.caption ?? item.title}
                        aspectRatio="16 / 9"
                        src={resolveScreenshotPreviewAsset(item.screenshot)}
                      />
                    </button>
                  </div>
                </article>
              ))}
            </div>
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
          selectedEvent={selectedEvent}
          selectedScreenshot={selectedScreenshot}
        />
      </SectionCard>

      <SessionImageLightbox
        imageAlt={lightboxImage?.alt ?? ''}
        imageSrc={lightboxImage?.src ?? null}
        onClose={() => setLightboxImage(null)}
        open={Boolean(lightboxImage)}
        title={lightboxImage?.title ?? ''}
      />

      {hasAnnotationMaintenance ? (
        <SectionCard title="图上标注（按需展开）" subtitle="平时直接在图上处理；只有要改标题、升级记忆或恢复删除内容时再展开。">
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
