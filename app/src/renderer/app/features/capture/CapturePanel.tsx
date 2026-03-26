import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import { translateAnnotationShape, translateCaptureKind } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'

type CapturePanelProps = {
  screenshot: ScreenshotRecord | null
  annotations: DraftAnnotation[]
  onSnip: () => void
  onImport: () => void
  onSave: () => void
  busy?: boolean
}

const MAX_ANNOTATION_PREVIEW = 4

export const CapturePanel = ({ screenshot, annotations, onSnip, onImport, onSave, busy }: CapturePanelProps) => {
  const previewAnnotations = annotations.slice(0, MAX_ANNOTATION_PREVIEW)
  const hiddenAnnotationCount = Math.max(annotations.length - previewAnnotations.length, 0)
  const hasAnnotations = annotations.length > 0

  const metaEntries = screenshot ? [
    { label: '当前 Session', value: screenshot.session_id },
    { label: '关联事件', value: screenshot.event_id ?? '待关联事件' },
    { label: '类型', value: translateCaptureKind(screenshot.kind) },
    { label: '尺寸', value: `${screenshot.width} × ${screenshot.height}` },
    { label: 'Vault 路径', value: screenshot.file_path },
    { label: '待保存标注', value: `${annotations.length}` },
  ] : []

  return (
    <div className="stack capture-panel">
      <div className="action-row">
        <button className="button is-primary" disabled={busy} onClick={onSnip} type="button">快捷截图</button>
        <button className="button is-secondary" disabled={busy} onClick={onImport} type="button">导入文件</button>
        <button className="button is-secondary" disabled={!screenshot || busy} onClick={onSave} type="button">保存到当前上下文</button>
      </div>

      <div className="capture-panel__shortcut-row">
        <span className="badge">Ctrl/Cmd+Shift+4 快速截图</span>
        <span className="badge">Ctrl/Cmd+Shift+C 复制但不关闭</span>
        <span className="badge">Enter 送入笔记</span>
      </div>

      {screenshot ? (
        <div className="capture-panel__meta-grid">
          {metaEntries.map((entry) => (
            <div key={entry.label} className="capture-panel__meta-item">
              <p className="capture-panel__meta-label">{entry.label}</p>
              <strong>{entry.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">先在事件流里选择截图，或导入一张新图片开始。</div>
      )}

      <div className="capture-panel__annotation-summary">
        <div className="capture-panel__annotation-title">
          <strong>待保存标注</strong>
          <span className="badge">{annotations.length} 个待处理</span>
        </div>
        {hasAnnotations ? (
          <ul className="capture-panel__annotation-list">
            {previewAnnotations.map((annotation, index) => (
              <li key={`${annotation.label}-${index}`}>
                <span className="capture-panel__annotation-label">{annotation.label}</span>
                <span className="capture-panel__annotation-meta">{translateAnnotationShape(annotation.shape)}</span>
                <span className="capture-panel__annotation-meta">{Math.round(annotation.x2 - annotation.x1)}px × {Math.round(annotation.y2 - annotation.y1)}px</span>
              </li>
            ))}
            {hiddenAnnotationCount > 0 && (
              <li className="capture-panel__annotation-more">
                还有 +{hiddenAnnotationCount} 个标注待保存
              </li>
            )}
          </ul>
        ) : (
          <p className="capture-panel__hint">点击画布即可直接在导入截图上落矩形、箭头、文本等标注。</p>
        )}
      </div>

      <pre className="code-preview">
        {JSON.stringify({
          screenshot_id: screenshot?.id ?? null,
          annotation_count: annotations.length,
          annotations,
        }, null, 2)}
      </pre>
    </div>
  )
}
