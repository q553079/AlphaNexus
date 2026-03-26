import { SectionCard } from '@app/components/SectionCard'
import { AnnotationCanvas } from '@app/features/annotation/AnnotationCanvas'
import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import { AnchorAnnotationInspector } from '@app/features/anchors'
import type { AnnotationInspectorItem } from '@app/features/anchors'
import { CapturePanel } from '@app/features/capture/CapturePanel'
import { ContentBlockTargetManager } from '@app/features/context/ContentBlockTargetManager'
import { AnnotationSuggestionsPanel } from '@app/features/suggestions'
import type { AnnotationSuggestionView } from '@app/features/suggestions'
import { translateContextType } from '@app/ui/display-text'
import type { AnnotationRecord, ContentBlockRecord, ScreenshotRecord } from '@shared/contracts/content'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'

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
  onDeleteScreenshot: (screenshotId: string) => void
  onDraftAnnotationsChange: (annotations: DraftAnnotation[]) => void
  onImportScreenshot: () => void
  onSnipScreenshot: () => void
  onRestoreAnnotation: (annotationId: string) => void
  onRestoreBlock: (block: ContentBlockRecord) => void
  onRestoreScreenshot: (screenshotId: string) => void
  onSaveAnnotations: () => void
  moveTargetOptions: CurrentTargetOptionsPayload | null
  selectedScreenshot: ScreenshotRecord | null
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
  onDeleteScreenshot,
  onDraftAnnotationsChange,
  onImportScreenshot,
  onSnipScreenshot,
  onRestoreAnnotation,
  onRestoreBlock,
  onRestoreScreenshot,
  onSaveAnnotations,
  moveTargetOptions,
  selectedScreenshot,
}: SessionCanvasColumnProps) => (
    <section className="session-workbench__column session-workbench__column--canvas">
      <SectionCard title="图表上下文" subtitle="当前时刻的图表与标注">
        <div className="session-workbench__canvas-frame">
          <AnnotationCanvas
            annotations={draftAnnotations}
            onChange={onDraftAnnotationsChange}
            screenshot={selectedScreenshot}
          />
        </div>
        {selectedScreenshot ? (
          <div className="session-workbench__canvas-meta">
            <p className="session-workbench__canvas-title">{selectedScreenshot.caption ?? '未命名截图'}</p>
            <p className="session-workbench__canvas-path">{selectedScreenshot.file_path}</p>
            <div className="action-row">
              <button className="button is-secondary" disabled={busy} onClick={() => onDeleteScreenshot(selectedScreenshot.id)} type="button">
                删除当前截图
              </button>
            </div>
          </div>
        ) : (
          <div className="session-workbench__canvas-empty">选择一个事件后即可查看画布详情。</div>
        )}
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
              <article className="session-workbench__content-block" key={annotation.id}>
                <div className="session-workbench__content-header">
                  <div>
                    <h3>{annotation.label}</h3>
                    <p className="session-workbench__content-meta">
                      {annotation.shape} · {annotation.color}
                    </p>
                  </div>
                  <button className="button is-ghost" disabled={busy} onClick={() => onDeleteAnnotation(annotation.id)} type="button">
                    删除
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">当前截图没有已保存标注。</p>
          )}
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
