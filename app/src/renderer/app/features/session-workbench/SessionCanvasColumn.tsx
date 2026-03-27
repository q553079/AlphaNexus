import { useEffect, useMemo, useState } from 'react'
import { SectionCard } from '@app/components/SectionCard'
import { AnnotationCanvas } from '@app/features/annotation/AnnotationCanvas'
import { AnnotationMetadataEditor } from '@app/features/annotation/AnnotationMetadataEditor'
import type { DraftAnnotation, PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import { AnchorAnnotationInspector } from '@app/features/anchors'
import type { AnnotationInspectorItem } from '@app/features/anchors'
import { CapturePanel } from '@app/features/capture/CapturePanel'
import { ContentBlockTargetManager } from '@app/features/context/ContentBlockTargetManager'
import { TargetSelector } from '@app/features/context/TargetSelector'
import { AnnotationSuggestionsPanel } from '@app/features/suggestions'
import type { AnnotationSuggestionView } from '@app/features/suggestions'
import { translateContextType } from '@app/ui/display-text'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'
import type { ScreenshotGalleryState } from './modules/session-screenshot-gallery'

type SessionCanvasColumnProps = {
  activeContentBlocks: ContentBlockRecord[]
  adoptedAnnotationKeys: Set<string>
  activeAnnotations: AnnotationRecord[]
  annotationInspectorItems: AnnotationInspectorItem[]
  annotationSuggestions: AnnotationSuggestionView[]
  busy: boolean
  deletedAnnotations: AnnotationRecord[]
  deletedContentBlocks: ContentBlockRecord[]
  deletedScreenshots: ScreenshotRecord[]
  draftAnnotations: DraftAnnotation[]
  onAdoptAnchor: (item: AnnotationInspectorItem) => void
  onAnnotationSuggestionAction: (suggestionId: string, action: 'keep' | 'merge' | 'discard') => void
  onDeleteAnnotation: (annotationId: string) => void
  onDeleteBlock: (block: ContentBlockRecord) => void
  onMoveContentBlock: (block: ContentBlockRecord, option: CurrentTargetOption) => void
  onMoveScreenshot: (screenshot: ScreenshotRecord, option: CurrentTargetOption) => void
  onDeleteScreenshot: (screenshotId: string) => void
  onDraftAnnotationsChange: (annotations: DraftAnnotation[]) => void
  onImportScreenshot: () => void
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
  moveTargetOptions: CurrentTargetOptionsPayload | null
  onSelectScreenshot: (screenshotId: string) => void
  screenshotGallery: ScreenshotGalleryState
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

export const SessionCanvasColumn = ({
  activeContentBlocks,
  adoptedAnnotationKeys,
  activeAnnotations,
  annotationInspectorItems,
  annotationSuggestions,
  busy,
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
  onSnipScreenshot,
  onRestoreAnnotation,
  onRestoreBlock,
  onRestoreScreenshot,
  onSaveAnnotations,
  onUpdateAnnotation,
  moveTargetOptions,
  onSelectScreenshot,
  screenshotGallery,
  selectedScreenshot,
}: SessionCanvasColumnProps) => {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
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

  useEffect(() => {
    setSelectedAnnotationId((current) =>
      current && activeAnnotations.some((annotation) => annotation.id === current)
        ? current
        : activeAnnotations[0]?.id ?? null)
  }, [activeAnnotations])

  return (
    <section className="session-workbench__column session-workbench__column--canvas">
      <SectionCard title="图表上下文" subtitle="当前时刻的图表与标注">
        {screenshotGallery.screenshots.length > 0 ? (
          <div className="tab-strip session-workbench__tabs">
            {screenshotGallery.screenshots.map((screenshot, index) => (
              <button
                className={`tab-button ${selectedScreenshot?.id === screenshot.id ? 'is-active' : ''}`.trim()}
                key={screenshot.id}
                onClick={() => onSelectScreenshot(screenshot.id)}
                type="button"
              >
                {screenshot.caption ?? `截图 ${index + 1}`}
              </button>
            ))}
          </div>
        ) : null}
        <div className="session-workbench__canvas-frame">
          <AnnotationCanvas
            annotations={draftAnnotations}
            candidateAnnotations={candidateAnnotations}
            onChange={onDraftAnnotationsChange}
            screenshot={selectedScreenshot}
          />
        </div>
        {selectedScreenshot ? (
          <div className="session-workbench__canvas-meta">
            <p className="session-workbench__canvas-title">{selectedScreenshot.caption ?? '未命名截图'}</p>
            <p className="session-workbench__canvas-path">{selectedScreenshot.file_path}</p>
            <p className="session-workbench__canvas-path">Audit · raw={selectedScreenshot.raw_file_path} · annotated={selectedScreenshot.annotated_file_path ?? 'none'} · annotations={selectedScreenshot.annotations_json_path ?? 'none'}</p>
            {screenshotTargetPayload ? (
              <TargetSelector
                busy={busy}
                emptyMessage="当前没有可用于截图改挂载的目标。"
                label={`${screenshotGallery.scope_label} · 改挂载`}
                onSelect={(option) => onMoveScreenshot(selectedScreenshot, option)}
                selectedOptionId={selectedScreenshotTargetOption?.id ?? null}
                targetPayload={screenshotTargetPayload}
                variant="compact"
              />
            ) : null}
            <div className="action-row">
              <button className="button is-secondary" disabled={busy} onClick={() => onDeleteScreenshot(selectedScreenshot.id)} type="button">
                删除当前截图
              </button>
            </div>
          </div>
        ) : (
          <div className="session-workbench__canvas-empty">选择一个事件后即可查看画布详情。</div>
        )}
        {screenshotGallery.compare_pair?.setup && screenshotGallery.compare_pair.exit ? (
          <div className="session-workbench__content-blocks">
            <p className="session-workbench__deleted-label">Setup / Exit 基础对照</p>
            <div className="trade-thread-media">
              {[{
                title: 'Setup',
                screenshot: screenshotGallery.compare_pair.setup,
              }, {
                title: 'Exit',
                screenshot: screenshotGallery.compare_pair.exit,
              }].map((item) => (
                <article className="trade-thread-media__stage" key={item.title}>
                  <div className="trade-thread-media__meta">
                    <div>
                      <p className="trade-thread-media__eyebrow">{item.title}</p>
                      <h3>{item.screenshot.caption ?? `${item.title} 图`}</h3>
                      <p>{item.screenshot.file_path}</p>
                    </div>
                  </div>
                  <div className="trade-thread-media__hero">
                    <img alt={item.screenshot.caption ?? item.title} src={item.screenshot.annotated_asset_url ?? item.screenshot.raw_asset_url ?? item.screenshot.asset_url} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="标注与内容" subtitle="截图控制、建议层和内容块">
        <CapturePanel
          annotations={draftAnnotations}
          busy={busy}
          onImport={onImportScreenshot}
          onSnip={onSnipScreenshot}
          onSave={onSaveAnnotations}
          screenshot={selectedScreenshot}
        />
        <div className="session-workbench__anchor-adopt">
          <p className="session-workbench__deleted-label">标注检查器</p>
          <AnchorAnnotationInspector
            adoptedKeys={adoptedAnnotationKeys}
            busy={busy}
            items={annotationInspectorItems}
            onAdopt={onAdoptAnchor}
          />
        </div>
        <div className="session-workbench__suggestion-layer">
          <p className="session-workbench__deleted-label">AI Annotation Suggestions（建议层）</p>
          <p className="session-workbench__layer-hint">AI 建议不会自动覆盖正式标注，只有 Keep / Merge 后才会进入下一步流程。</p>
          <AnnotationSuggestionsPanel
            busy={busy}
            suggestions={annotationSuggestions}
            onDiscard={(suggestionId) => onAnnotationSuggestionAction(suggestionId, 'discard')}
            onKeep={(suggestionId) => onAnnotationSuggestionAction(suggestionId, 'keep')}
            onMerge={(suggestionId) => onAnnotationSuggestionAction(suggestionId, 'merge')}
          />
        </div>
        <div className="session-workbench__content-blocks">
          <p className="session-workbench__deleted-label">当前截图标注</p>
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
                      {annotation.label} · {annotation.shape} · {annotation.semantic_type ?? '未指定语义'}
                    </p>
                  </div>
                  <button className="button is-secondary" disabled={busy} onClick={() => setSelectedAnnotationId(annotation.id)} type="button">
                    编辑
                  </button>
                </div>
                {annotation.note_md ? <p className="workbench-text">{annotation.note_md}</p> : null}
                <div className="action-row">
                  {annotation.add_to_memory ? <span className="status-pill">memory candidate</span> : null}
                  <span className="status-pill">{annotation.color}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">当前截图没有已保存标注。</p>
          )}
          <AnnotationMetadataEditor
            annotation={selectedAnnotation}
            busy={busy}
            onDelete={onDeleteAnnotation}
            onSave={onUpdateAnnotation}
          />
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
                      <p className="session-workbench__content-meta">{screenshot.file_path}</p>
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
          {activeContentBlocks.length > 0 ? (
            activeContentBlocks.map((block) => (
              <article className="session-workbench__content-block" key={block.id}>
                <div className="session-workbench__content-header">
                  <div>
                    <h3>{block.title}</h3>
                    <p className="session-workbench__content-meta">
                      {translateContextType(block.context_type)} · {block.context_id}
                    </p>
                  </div>
                  <button className="button is-ghost" disabled={busy} onClick={() => onDeleteBlock(block)} type="button">
                    删除
                  </button>
                </div>
                <p className="workbench-text">{block.content_md}</p>
                <ContentBlockTargetManager
                  block={block}
                  busy={busy}
                  onMove={onMoveContentBlock}
                  targetPayload={moveTargetOptions}
                />
              </article>
            ))
          ) : (
            <p className="empty-state">还没有内容块。</p>
          )}
          {deletedContentBlocks.length > 0 ? (
            <div className="session-workbench__deleted-group">
              <p className="session-workbench__deleted-label">已删除内容块</p>
              {deletedContentBlocks.map((block) => (
                <article className="session-workbench__content-block is-deleted" key={block.id}>
                  <div className="session-workbench__content-header">
                    <div>
                      <h3>{block.title}</h3>
                      <p className="session-workbench__content-meta">软删除</p>
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
      </SectionCard>
    </section>
  )
}
