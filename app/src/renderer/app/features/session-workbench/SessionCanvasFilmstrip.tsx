import { LazyImage } from '@app/components/LazyImage'
import { formatTime } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'

type SessionCanvasFilmstripProps = {
  selectedScreenshotId: string | null
  trayPrimaryScreenshotId: string | null
  trayScreenshotIds: string[]
  screenshots: ScreenshotRecord[]
  onAddToTray: (screenshotId: string) => void
  onSelectScreenshot: (screenshotId: string) => void
}

const resolvePreviewAsset = (screenshot: ScreenshotRecord) =>
  screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url

export const SessionCanvasFilmstrip = ({
  selectedScreenshotId,
  trayPrimaryScreenshotId,
  trayScreenshotIds,
  screenshots,
  onAddToTray,
  onSelectScreenshot,
}: SessionCanvasFilmstripProps) => (
  <section className="session-workbench__filmstrip">
    <div className="session-workbench__filmstrip-header">
      <div>
        <strong>Filmstrip 胶片流</strong>
        <p>点击缩略图切换主舞台。这里不再把所有截图渲染成长卡片堆叠。</p>
      </div>
      <span className="status-pill">{screenshots.length}</span>
    </div>

    {screenshots.length > 0 ? (
      <div className="session-workbench__filmstrip-track">
        {screenshots.map((screenshot) => {
          const inTray = trayScreenshotIds.includes(screenshot.id)
          const isPrimary = trayPrimaryScreenshotId === screenshot.id
          const isSelected = selectedScreenshotId === screenshot.id
          return (
            <article
              className={`session-workbench__filmstrip-item ${isSelected ? 'is-active' : ''}`.trim()}
              key={screenshot.id}
            >
              <button
                className="session-workbench__filmstrip-thumb"
                onClick={() => onSelectScreenshot(screenshot.id)}
                type="button"
              >
                <LazyImage
                  alt={screenshot.caption ?? screenshot.id}
                  aspectRatio="16 / 9"
                  src={resolvePreviewAsset(screenshot)}
                />
              </button>
              <div className="session-workbench__filmstrip-meta">
                <strong>{screenshot.caption ?? screenshot.id}</strong>
                <span>{formatTime(screenshot.created_at)}</span>
              </div>
              <div className="session-workbench__filmstrip-pills">
                {screenshot.annotations.length > 0 ? <span className="status-pill">标注 {screenshot.annotations.length}</span> : null}
                {inTray ? <span className="status-pill">已入托盘</span> : null}
                {isPrimary ? <span className="status-pill">主图</span> : null}
              </div>
              {!inTray ? (
                <button
                  className="button is-secondary session-workbench__filmstrip-action"
                  onClick={() => onAddToTray(screenshot.id)}
                  type="button"
                >
                  加入托盘
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
    ) : (
      <div className="session-workbench__stage-empty">当前 session 没有可展示的截图。</div>
    )}
  </section>
)
