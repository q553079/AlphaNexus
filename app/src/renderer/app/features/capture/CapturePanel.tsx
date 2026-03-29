import type { DraftAnnotation } from '@app/features/annotation/annotation-types'
import { translateCaptureKind } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'

type CapturePanelProps = {
  screenshot: ScreenshotRecord | null
  annotations: DraftAnnotation[]
  onSnip: () => void
  onImport: () => void
  onRunAnalysis?: () => void
  onSave: () => void
  busy?: boolean
  showSaveButton?: boolean
}

export const CapturePanel = ({
  screenshot,
  annotations,
  onSnip,
  onImport,
  onRunAnalysis,
  onSave,
  busy,
  showSaveButton = true,
}: CapturePanelProps) => {
  const hasAnnotations = annotations.length > 0

  return (
    <div className="stack capture-panel">
      <div className="action-row">
        <button className="button is-primary" disabled={busy} onClick={onSnip} type="button">快捷截图</button>
        <button className="button is-secondary" disabled={busy} onClick={onImport} type="button">导入文件</button>
        {showSaveButton ? (
          <button className="button is-secondary" disabled={!screenshot || busy} onClick={onSave} type="button">保存标注</button>
        ) : null}
        <button
          className="button is-secondary"
          disabled={!screenshot || busy}
          onClick={onRunAnalysis}
          type="button"
        >
          发给 AI
        </button>
      </div>

      <div className="capture-panel__shortcut-row">
        <span className="badge">控制键/命令键+上档键+4 快速截图</span>
        <span className="badge">控制键/命令键+上档键+C 复制但不关闭</span>
        <span className="badge">回车键 送入笔记</span>
      </div>

      {screenshot ? (
        <div className="capture-panel__summary-strip">
          <div className="capture-panel__summary-head">
            <strong>{screenshot.caption ?? '当前截图'}</strong>
            <span className="badge">{translateCaptureKind(screenshot.kind)}</span>
            {hasAnnotations ? <span className="badge">待保存标注 {annotations.length}</span> : null}
          </div>
        </div>
      ) : (
        <div className="empty-state">先在事件流里选择截图，或导入一张新图片开始。</div>
      )}

      <p className="capture-panel__hint">
        {hasAnnotations
          ? `当前有 ${annotations.length} 个新标注待保存，确认后会写入本地并加入当前事件流。`
          : '直接在图上画矩形、箭头、文本等标注。AI 候选会直接叠加在画布上，不再在这里铺成长列表。'}
      </p>

    </div>
  )
}
