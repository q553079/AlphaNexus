import { LazyImage } from '@app/components/LazyImage'
import { formatTime } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'

type SessionCanvasAnalysisTrayProps = {
  compareScreenshotId: string | null
  primaryScreenshotId: string | null
  screenshots: ScreenshotRecord[]
  onClear: () => void
  onMove: (screenshotId: string, direction: 'backward' | 'forward') => void
  onOpenComposer: () => void
  onRemove: (screenshotId: string) => void
  onSelectScreenshot: (screenshotId: string) => void
  onSetCompare: (screenshotId: string | null) => void
  onSetPrimary: (screenshotId: string) => void
}

const resolvePreviewAsset = (screenshot: ScreenshotRecord) =>
  screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url

export const SessionCanvasAnalysisTray = ({
  compareScreenshotId,
  primaryScreenshotId,
  screenshots,
  onClear,
  onMove,
  onOpenComposer,
  onRemove,
  onSelectScreenshot,
  onSetCompare,
  onSetPrimary,
}: SessionCanvasAnalysisTrayProps) => (
  <section className="session-workbench__analysis-tray">
    <div className="session-workbench__analysis-tray-header">
      <div>
        <strong>Analysis Tray</strong>
        <p>这里是后续 AI 发包的图像输入源。可删除、设主图、设对照，再送进 AI composer。</p>
      </div>
      <div className="action-row">
        <button
          className="button is-secondary"
          disabled={screenshots.length === 0}
          onClick={onClear}
          type="button"
        >
          清空托盘
        </button>
        <button
          className="button is-primary"
          disabled={screenshots.length === 0}
          onClick={onOpenComposer}
          type="button"
        >
          打开发包器
        </button>
      </div>
    </div>

    {screenshots.length > 0 ? (
      <div className="session-workbench__analysis-tray-grid">
        {screenshots.map((screenshot, screenshotIndex) => {
          const isPrimary = primaryScreenshotId === screenshot.id
          const isCompare = compareScreenshotId === screenshot.id
          return (
            <article className={`session-workbench__analysis-tray-item ${isPrimary ? 'is-primary' : ''}`.trim()} key={screenshot.id}>
              <button
                className="session-workbench__analysis-tray-thumb"
                onClick={() => onSelectScreenshot(screenshot.id)}
                type="button"
              >
                <LazyImage
                  alt={screenshot.caption ?? screenshot.id}
                  aspectRatio="16 / 9"
                  src={resolvePreviewAsset(screenshot)}
                />
              </button>
              <div className="session-workbench__analysis-tray-meta">
                <strong>{screenshot.caption ?? screenshot.id}</strong>
                <span>{formatTime(screenshot.created_at)}</span>
              </div>
              <div className="session-workbench__analysis-tray-pills">
                {isPrimary ? <span className="status-pill">主图</span> : null}
                {isCompare ? <span className="status-pill">对照图</span> : null}
                {screenshot.annotations.length > 0 ? <span className="status-pill">标注 {screenshot.annotations.length}</span> : null}
              </div>
              <div className="action-row">
                <button
                  className="button is-secondary"
                  disabled={screenshotIndex === 0}
                  onClick={() => onMove(screenshot.id, 'backward')}
                  type="button"
                >
                  前移
                </button>
                <button
                  className="button is-secondary"
                  disabled={screenshotIndex === screenshots.length - 1}
                  onClick={() => onMove(screenshot.id, 'forward')}
                  type="button"
                >
                  后移
                </button>
                <button
                  className="button is-secondary"
                  onClick={() => onSetPrimary(screenshot.id)}
                  type="button"
                >
                  {isPrimary ? '当前主图' : '设为主图'}
                </button>
                <button
                  className="button is-secondary"
                  onClick={() => onSetCompare(isCompare ? null : screenshot.id)}
                  type="button"
                >
                  {isCompare ? '取消对照' : '设为对照'}
                </button>
                <button
                  className="button is-secondary"
                  onClick={() => onRemove(screenshot.id)}
                  type="button"
                >
                  移出
                </button>
              </div>
            </article>
          )
        })}
      </div>
    ) : (
      <div className="session-workbench__stage-empty">当前还没有加入 analysis tray 的截图。可从左侧多选事件或下方胶片流加入。</div>
    )}
  </section>
)
