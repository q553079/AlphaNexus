import type { ScreenshotRecord } from '@shared/contracts/content'
import { translateCaptureKind } from '@app/ui/display-text'
import { LazyImage } from '@app/components/LazyImage'

type TradeThreadMediaStripProps = {
  setupScreenshot: ScreenshotRecord | null
  setupScreenshots: ScreenshotRecord[]
  manageScreenshots: ScreenshotRecord[]
  exitScreenshot: ScreenshotRecord | null
  exitScreenshots: ScreenshotRecord[]
}

const StageCard = (props: {
  count: number
  primaryScreenshot: ScreenshotRecord | null
  secondaryScreenshots?: ScreenshotRecord[]
  subtitle: string
  title: string
}) => (
  <article className="trade-thread-media__stage">
    <div className="trade-thread-media__meta">
      <div>
        <p className="trade-thread-media__eyebrow">{props.title}</p>
        <h3>{props.primaryScreenshot?.caption ?? `${props.title} 待补截图`}</h3>
        <p>{props.subtitle}</p>
      </div>
      <span className="metric-pill">{props.count} 张</span>
    </div>

    {props.primaryScreenshot ? (
      <div className="trade-thread-media__hero">
        <LazyImage alt={props.primaryScreenshot.caption ?? props.title} aspectRatio="16 / 9" src={props.primaryScreenshot.asset_url} />
        <div className="trade-thread-media__hero-meta">
          <span className="badge">{translateCaptureKind(props.primaryScreenshot.kind)}</span>
          <strong>{props.primaryScreenshot.caption ?? '无标题截图'}</strong>
        </div>
      </div>
    ) : <div className="empty-state">当前还没有这一段的截图。</div>}

    {props.secondaryScreenshots && props.secondaryScreenshots.length > 0 ? (
      <div className="trade-thread-media__filmstrip">
        {props.secondaryScreenshots.slice(0, 3).map((screenshot) => (
          <article className="trade-thread-media__thumb" key={screenshot.id}>
            <LazyImage alt={screenshot.caption ?? props.title} aspectRatio="16 / 9" src={screenshot.asset_url} />
            <span>{screenshot.caption ?? translateCaptureKind(screenshot.kind)}</span>
          </article>
        ))}
      </div>
    ) : null}
  </article>
)

export const TradeThreadMediaStrip = ({
  setupScreenshot,
  setupScreenshots,
  manageScreenshots,
  exitScreenshot,
  exitScreenshots,
}: TradeThreadMediaStripProps) => {
  const managePrimary = manageScreenshots[0] ?? null
  const manageSecondary = manageScreenshots.slice(1)

  return (
    <div className="trade-thread-media">
      <StageCard
        count={setupScreenshots.length}
        primaryScreenshot={setupScreenshot}
        subtitle="开仓前后用于建立交易前提的关键 setup 证据。"
        title="Setup 图"
      />
      <StageCard
        count={manageScreenshots.length}
        primaryScreenshot={managePrimary}
        secondaryScreenshots={manageSecondary}
        subtitle="持仓中用来说明管理、加减仓和执行节奏的过程画面。"
        title="Manage 图"
      />
      <StageCard
        count={exitScreenshots.length}
        primaryScreenshot={exitScreenshot}
        secondaryScreenshots={exitScreenshots.filter((shot) => shot.id !== exitScreenshot?.id)}
        subtitle="离场前后的结束证据，优先展示 exit screenshot。"
        title="Exit 图"
      />
    </div>
  )
}
