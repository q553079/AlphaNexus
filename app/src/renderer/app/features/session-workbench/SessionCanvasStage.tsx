import { LazyImage } from '@app/components/LazyImage'
import { formatTime } from '@app/ui/display-text'
import type { ScreenshotRecord } from '@shared/contracts/content'
import type { AnalysisTrayState, ScreenshotStageViewMode } from './session-workbench-types'

type SessionCanvasStageProps = {
  analysisTray: AnalysisTrayState
  compareScreenshot: ScreenshotRecord | null
  primaryScreenshot: ScreenshotRecord | null
  scopeLabel: string
  trayScreenshots: ScreenshotRecord[]
  viewMode: ScreenshotStageViewMode
  onAddPrimaryToTray: (screenshotId: string) => void
  onOpenAiComposer: (input?: {
    primaryScreenshotId?: string | null
  }) => void
  onQuickSendToAi: (screenshotId?: string | null) => Promise<void>
  onSelectScreenshot: (screenshotId: string) => void
  onSetCompareScreenshot: (screenshotId: string | null) => void
  onSetPrimaryAnalysisTrayScreenshot: (screenshotId: string) => void
  onSetViewMode: (mode: ScreenshotStageViewMode) => void
}

const resolvePreviewAsset = (screenshot: ScreenshotRecord) =>
  screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url

const renderStageTile = (input: {
  active?: boolean
  badge?: string
  onClick?: () => void
  screenshot: ScreenshotRecord
}) => (
  <button
    className={`session-workbench__stage-tile ${input.active ? 'is-active' : ''}`.trim()}
    onClick={input.onClick}
    type="button"
  >
    <div className="session-workbench__stage-tile-media">
      <LazyImage
        alt={input.screenshot.caption ?? input.screenshot.id}
        aspectRatio={`${input.screenshot.width} / ${input.screenshot.height}`}
        src={resolvePreviewAsset(input.screenshot)}
      />
      {input.badge ? <span className="status-pill session-workbench__stage-tile-badge">{input.badge}</span> : null}
    </div>
    <div className="session-workbench__stage-tile-meta">
      <strong>{input.screenshot.caption ?? input.screenshot.id}</strong>
      <span>{formatTime(input.screenshot.created_at)} · 标注 {input.screenshot.annotations.length}</span>
    </div>
  </button>
)

export const SessionCanvasStage = ({
  analysisTray,
  compareScreenshot,
  primaryScreenshot,
  scopeLabel,
  trayScreenshots,
  viewMode,
  onAddPrimaryToTray,
  onOpenAiComposer,
  onQuickSendToAi,
  onSelectScreenshot,
  onSetCompareScreenshot,
  onSetPrimaryAnalysisTrayScreenshot,
  onSetViewMode,
}: SessionCanvasStageProps) => {
  const boardScreenshots = trayScreenshots.length > 0
    ? trayScreenshots
    : primaryScreenshot
      ? [primaryScreenshot]
      : []

  return (
    <section className="session-workbench__stage-shell">
      <div className="session-workbench__stage-header">
        <div>
          <p className="session-workbench__stage-eyebrow">{scopeLabel}</p>
          <h3>大图主舞台</h3>
          <p className="session-workbench__stage-summary">
            当前主图：{primaryScreenshot?.caption ?? primaryScreenshot?.id ?? '未选择'} · AI 托盘 {analysisTray.screenshotIds.length} 张
          </p>
        </div>
        <div className="session-workbench__stage-actions">
          {(['single', 'compare', 'board'] as const).map((mode) => (
            <button
              className={`button ${viewMode === mode ? 'is-primary' : 'is-secondary'}`.trim()}
              key={mode}
              onClick={() => onSetViewMode(mode)}
              type="button"
            >
              {mode === 'single' ? '单图' : mode === 'compare' ? '对照' : '拼板'}
            </button>
          ))}
        </div>
      </div>

      {primaryScreenshot ? (
        <>
          <div className="session-workbench__stage-toolbar">
            <div className="session-workbench__stage-pills">
              <span className="status-pill">主图</span>
              {analysisTray.screenshotIds.includes(primaryScreenshot.id) ? <span className="status-pill">已在托盘</span> : null}
              {analysisTray.primaryScreenshotId === primaryScreenshot.id ? <span className="status-pill">托盘主图</span> : null}
            </div>
            <div className="action-row">
              <button
                className="button is-secondary"
                onClick={() => onAddPrimaryToTray(primaryScreenshot.id)}
                type="button"
              >
                {analysisTray.screenshotIds.includes(primaryScreenshot.id) ? '已在托盘' : '加入 AI 托盘'}
              </button>
              <button
                className="button is-secondary"
                onClick={() => onSetPrimaryAnalysisTrayScreenshot(primaryScreenshot.id)}
                type="button"
              >
                设为托盘主图
              </button>
              <button
                className="button is-secondary"
                onClick={() => {
                  void onQuickSendToAi(primaryScreenshot.id)
                }}
                type="button"
              >
                快速发送
              </button>
              <button
                className="button is-primary"
                onClick={() => onOpenAiComposer({
                  primaryScreenshotId: primaryScreenshot.id,
                })}
                type="button"
              >
                编辑后发送
              </button>
            </div>
          </div>

          {viewMode === 'single' ? (
            <div className="session-workbench__stage-panel is-single">
              {renderStageTile({
                active: true,
                badge: '主舞台',
                onClick: () => onSelectScreenshot(primaryScreenshot.id),
                screenshot: primaryScreenshot,
              })}
            </div>
          ) : null}

          {viewMode === 'compare' ? (
            <div className="session-workbench__stage-compare">
              {renderStageTile({
                active: true,
                badge: '主图',
                onClick: () => onSelectScreenshot(primaryScreenshot.id),
                screenshot: primaryScreenshot,
              })}
              {compareScreenshot ? (
                <div className="session-workbench__stage-compare-slot">
                  {renderStageTile({
                    badge: '对照图',
                    onClick: () => onSelectScreenshot(compareScreenshot.id),
                    screenshot: compareScreenshot,
                  })}
                  <div className="action-row">
                    <button
                      className="button is-secondary"
                      onClick={() => onSetCompareScreenshot(null)}
                      type="button"
                    >
                      取消对照
                    </button>
                    <button
                      className="button is-secondary"
                      onClick={() => onSetPrimaryAnalysisTrayScreenshot(compareScreenshot.id)}
                      type="button"
                    >
                      改为主图
                    </button>
                  </div>
                </div>
              ) : (
                <div className="session-workbench__stage-empty">
                  从下方 Analysis Tray 选一张图设为对照，就能进入双图查看。
                </div>
              )}
            </div>
          ) : null}

          {viewMode === 'board' ? (
            <div className="session-workbench__stage-board">
              {boardScreenshots.length > 0 ? boardScreenshots.map((screenshot) => renderStageTile({
                active: screenshot.id === primaryScreenshot.id,
                badge: screenshot.id === primaryScreenshot.id ? '主图' : analysisTray.compareScreenshotId === screenshot.id ? '对照图' : undefined,
                onClick: () => onSelectScreenshot(screenshot.id),
                screenshot,
              })) : (
                <div className="session-workbench__stage-empty">当前还没有可拼板的截图。</div>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="session-workbench__stage-empty">先在左侧选择事件，或在下方胶片流中点一张图，主舞台才会建立。</div>
      )}
    </section>
  )
}
