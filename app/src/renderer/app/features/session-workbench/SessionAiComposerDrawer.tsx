import type { ScreenshotRecord } from '@shared/contracts/content'
import type { AiPacketComposerState } from './session-workbench-types'

type SessionAiComposerDrawerProps = {
  busy: boolean
  composer: AiPacketComposerState | null
  onClose: () => void
  onRemoveBackgroundScreenshot: (screenshotId: string) => void
  onSend: () => void
  onSetBackgroundDraft: (value: string) => void
  onSetBackgroundToggle: (key: keyof AiPacketComposerState['backgroundToggles'], value: boolean) => void
  onSetImageRegionMode: (mode: AiPacketComposerState['imageRegionMode']) => void
  onSetPrimaryScreenshot: (screenshotId: string) => void
  screenshots: ScreenshotRecord[]
}

const resolvePreviewAsset = (screenshot: ScreenshotRecord) =>
  screenshot.annotated_asset_url ?? screenshot.raw_asset_url ?? screenshot.asset_url

export const SessionAiComposerDrawer = ({
  busy,
  composer,
  onClose,
  onRemoveBackgroundScreenshot,
  onSend,
  onSetBackgroundDraft,
  onSetBackgroundToggle,
  onSetImageRegionMode,
  onSetPrimaryScreenshot,
  screenshots,
}: SessionAiComposerDrawerProps) => {
  if (!composer?.open) {
    return null
  }

  const primaryScreenshot = composer.primaryScreenshotId
    ? screenshots.find((screenshot) => screenshot.id === composer.primaryScreenshotId) ?? null
    : null
  const backgroundScreenshots = composer.backgroundScreenshotIds
    .map((screenshotId) => screenshots.find((screenshot) => screenshot.id === screenshotId) ?? null)
    .filter((screenshot): screenshot is ScreenshotRecord => screenshot != null)

  return (
    <aside className="session-ai-composer" role="complementary">
      <div className="session-ai-composer__header">
        <div>
          <p className="session-ai-composer__eyebrow">AI 发包器</p>
          <h2>编辑后发送</h2>
          <p>确认主图、附图、背景项和最终打包内容后再送。</p>
        </div>
        <div className="action-row">
          <button className="button is-secondary" disabled={busy} onClick={onClose} type="button">
            关闭
          </button>
          <button className="button is-primary" disabled={busy || !primaryScreenshot} onClick={() => void onSend()} type="button">
            发送给 AI
          </button>
        </div>
      </div>

      <section className="session-ai-composer__section">
        <div className="session-ai-composer__section-head">
          <strong>发送对象</strong>
          <span className="status-pill">{composer.preview.summary}</span>
        </div>
        {primaryScreenshot ? (
          <article className="session-ai-composer__target-card is-primary">
            <img alt={primaryScreenshot.caption ?? primaryScreenshot.id} src={resolvePreviewAsset(primaryScreenshot)} />
            <div>
              <strong>主图</strong>
              <p>{primaryScreenshot.caption ?? primaryScreenshot.id}</p>
            </div>
          </article>
        ) : (
          <div className="empty-state">当前还没有主图。</div>
        )}
        <div className="session-ai-composer__attachment-list">
          {backgroundScreenshots.length > 0 ? (
            backgroundScreenshots.map((screenshot) => (
              <article className="session-ai-composer__target-card" key={screenshot.id}>
                <img alt={screenshot.caption ?? screenshot.id} src={resolvePreviewAsset(screenshot)} />
                <div>
                  <strong>{screenshot.caption ?? screenshot.id}</strong>
                  <p>{screenshot.kind}</p>
                </div>
                <div className="action-row">
                  <button
                    className="button is-secondary"
                    disabled={busy}
                    onClick={() => onSetPrimaryScreenshot(screenshot.id)}
                    type="button"
                  >
                    设为主图
                  </button>
                  <button
                    className="button is-secondary"
                    disabled={busy}
                    onClick={() => onRemoveBackgroundScreenshot(screenshot.id)}
                    type="button"
                  >
                    删除附图
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">当前没有附图，将只发送主图。</div>
          )}
        </div>
      </section>

      <section className="session-ai-composer__section">
        <div className="session-ai-composer__section-head">
          <strong>图像区域控制</strong>
        </div>
        <div className="session-ai-composer__mode-grid">
          {(['full', 'selection', 'annotations-only', 'full-with-highlight'] as const).map((mode) => (
            <button
              className={`button ${composer.imageRegionMode === mode ? 'is-primary' : 'is-secondary'}`.trim()}
              disabled={busy}
              key={mode}
              onClick={() => onSetImageRegionMode(mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>
      </section>

      <section className="session-ai-composer__section">
        <div className="session-ai-composer__section-head">
          <strong>背景信息开关</strong>
        </div>
        <div className="session-ai-composer__toggle-list">
          {(Object.keys(composer.backgroundToggles) as Array<keyof AiPacketComposerState['backgroundToggles']>).map((key) => (
            <label className="session-ai-composer__toggle" key={key}>
              <input
                checked={composer.backgroundToggles[key]}
                disabled={busy}
                onChange={(event) => onSetBackgroundToggle(key, event.target.checked)}
                type="checkbox"
              />
              <span>{key}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="session-ai-composer__section">
        <div className="session-ai-composer__section-head">
          <strong>背景说明草稿</strong>
          <span className="status-pill">{composer.backgroundDraftDirty ? '已编辑' : '自动草稿'}</span>
        </div>
        <textarea
          className="inline-input session-ai-composer__draft"
          disabled={busy}
          onChange={(event) => onSetBackgroundDraft(event.target.value)}
          rows={10}
          value={composer.backgroundDraft}
        />
      </section>

      <section className="session-ai-composer__section">
        <div className="session-ai-composer__section-head">
          <strong>最终预览</strong>
        </div>
        <p className="workbench-text">{composer.preview.summary}</p>
        <div className="session-ai-composer__preview-columns">
          <div>
            <strong>将发送</strong>
            <ul className="session-ai-composer__bullet-list">
              {composer.preview.includedItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div>
            <strong>不发送</strong>
            <ul className="session-ai-composer__bullet-list">
              {composer.preview.omittedItems.length > 0
                ? composer.preview.omittedItems.map((item) => <li key={item}>{item}</li>)
                : <li>无</li>}
            </ul>
          </div>
        </div>
      </section>
    </aside>
  )
}
