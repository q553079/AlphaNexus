import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'
import { formatTime } from '@app/ui/display-text'
import type { AiDockState, AiDockTab, AiPacketComposerState, AiPacketDispatchRecord } from './session-workbench-types'

type SessionAiDockProps = {
  busy: boolean
  composer: AiPacketComposerState | null
  contextChips: string[]
  dockDraft: string
  dockState: AiDockState
  dockTab: AiDockTab
  lastPacket: AiPacketDispatchRecord | null
  onOpenComposer: () => void
  onSendFollowUp: () => void
  onSetDockDraft: (value: string) => void
  onSetDockExpanded: (expanded: boolean) => void
  onSetDockSize: (size: AiDockState['size']) => void
  onSetDockTab: (tab: AiDockTab) => void
  payload: SessionWorkbenchPayload | null
}

const summarizePacketPreview = (promptPreview: string) => {
  const compact = promptPreview.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return '本轮没有可展示的 packet 预览。'
  }
  return compact.length > 320 ? `${compact.slice(0, 317).trim()}...` : compact
}

export const SessionAiDock = ({
  busy,
  composer,
  contextChips,
  dockDraft,
  dockState,
  dockTab,
  lastPacket,
  onOpenComposer,
  onSendFollowUp,
  onSetDockDraft,
  onSetDockExpanded,
  onSetDockSize,
  onSetDockTab,
  payload,
}: SessionAiDockProps) => {
  const packetSummary = lastPacket?.preview.summary ?? composer?.preview.summary ?? '当前还没有发包上下文。'
  const turns = payload
    ? payload.analysis_cards
      .map((card) => {
        const aiRun = payload.ai_runs.find((run) => run.id === card.ai_run_id) ?? null
        const aiEvent = payload.events.find((event) => event.ai_run_id === card.ai_run_id) ?? null
        if (!aiRun) {
          return null
        }
        return {
          aiEvent,
          aiRun,
          card,
        }
      })
      .filter((turn): turn is NonNullable<typeof turn> => turn != null)
      .sort((left, right) => (left.aiEvent?.occurred_at ?? left.aiRun.created_at).localeCompare(right.aiEvent?.occurred_at ?? right.aiRun.created_at))
    : []

  return (
    <section className={`session-ai-dock is-${dockState.size} ${dockState.expanded ? 'is-expanded' : 'is-collapsed'}`.trim()}>
      <div className="session-ai-dock__bar">
        <div>
          <p className="session-ai-dock__eyebrow">大 AI 深聊舱</p>
          <h2>AI Dock</h2>
          <p>{packetSummary}</p>
        </div>
        <div className="action-row">
          {(['peek', 'medium', 'large'] as const).map((size) => (
            <button
              className={`button ${dockState.size === size ? 'is-primary' : 'is-secondary'}`.trim()}
              disabled={busy}
              key={size}
              onClick={() => onSetDockSize(size)}
              type="button"
            >
              {size}
            </button>
          ))}
          <button
            className="button is-secondary"
            disabled={busy}
            onClick={() => onSetDockExpanded(!dockState.expanded)}
            type="button"
          >
            {dockState.expanded ? '收起' : '展开'}
          </button>
        </div>
      </div>

      <div className="session-ai-dock__chips">
        {contextChips.length > 0 ? contextChips.map((chip) => <span className="status-pill" key={chip}>{chip}</span>) : (
          <span className="status-pill">当前没有上下文 chips</span>
        )}
      </div>

      {dockState.expanded ? (
        <div className="session-ai-dock__body">
          <div className="session-ai-dock__tabs">
            {(['summary', 'full', 'packet'] as const).map((tab) => (
              <button
                className={`button ${dockTab === tab ? 'is-primary' : 'is-secondary'}`.trim()}
                disabled={busy}
                key={tab}
                onClick={() => onSetDockTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="session-ai-dock__thread">
            {dockTab === 'packet' && lastPacket ? (
              <div className="session-ai-dock__packet-card">
                <div className="session-ai-dock__meta">
                  <strong>当前 Packet</strong>
                  <span>{formatTime(lastPacket.sentAt)}</span>
                </div>
                <div className="session-ai-dock__packet-summary">
                  <p>{lastPacket.preview.summary}</p>
                  {lastPacket.followUpQuestion ? <p>追问：{lastPacket.followUpQuestion}</p> : null}
                </div>
                <div className="session-ai-dock__chips">
                  <span className="status-pill">主图 {lastPacket.primaryScreenshotId ? 1 : 0}</span>
                  <span className="status-pill">附图 {lastPacket.backgroundScreenshotIds.length}</span>
                  <span className="status-pill">区间 {lastPacket.sourceEventIds.length}</span>
                </div>
                <div className="session-workbench__composer-attachments">
                  {lastPacket.attachments.map((attachment) => (
                    <article className="session-workbench__composer-attachment" key={attachment.id}>
                      {attachment.previewDataUrl ? (
                        <img
                          alt={attachment.name}
                          className="session-workbench__composer-attachment-thumb"
                          src={attachment.previewDataUrl}
                        />
                      ) : (
                        <div className="session-workbench__composer-attachment-icon">IMG</div>
                      )}
                      <div className="session-workbench__composer-attachment-meta">
                        <strong>{attachment.name}</strong>
                        <span>{attachment.resolvedModeLabel}</span>
                        <p>{attachment.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <pre className="session-ai-dock__packet-preview">{lastPacket.backgroundDraft || '当前没有额外背景说明。'}</pre>
              </div>
            ) : null}
            {turns.length > 0 ? (
              turns.map((turn) => (
                <div className="session-ai-dock__turn" key={turn.aiRun.id}>
                  <article className="session-ai-dock__bubble is-user">
                    <div className="session-ai-dock__meta">
                      <strong>发送包</strong>
                      <span>{formatTime(turn.aiEvent?.occurred_at ?? turn.aiRun.created_at)}</span>
                    </div>
                    <div className="session-ai-dock__text">{turn.aiRun.input_summary}</div>
                    {dockTab === 'packet' ? (
                      <pre className="session-ai-dock__packet-preview">{summarizePacketPreview(turn.aiRun.prompt_preview)}</pre>
                    ) : null}
                  </article>
                  <article className="session-ai-dock__bubble is-ai">
                    <div className="session-ai-dock__meta">
                      <strong>{turn.aiRun.provider}</strong>
                      <span>{turn.aiRun.model}</span>
                    </div>
                    <div className="session-ai-dock__text">
                      {dockTab === 'full'
                        ? turn.card.deep_analysis_md
                        : dockTab === 'packet'
                          ? summarizePacketPreview(turn.aiRun.prompt_preview)
                          : turn.card.summary_short}
                    </div>
                  </article>
                </div>
              ))
            ) : (
              <div className="empty-state">还没有 AI 对话记录。先快速发送或打开发包器。</div>
            )}
          </div>

          <div className="session-ai-dock__composer">
            <textarea
              className="inline-input session-ai-dock__input"
              disabled={busy}
              onChange={(event) => onSetDockDraft(event.target.value)}
              placeholder="在这里继续追问。深聊舱会沿用当前 packet 上下文继续发给 AI。"
              rows={6}
              value={dockDraft}
            />
            <div className="action-row">
              <button className="button is-secondary" disabled={busy} onClick={onOpenComposer} type="button">
                打开发包器
              </button>
              <button
                className="button is-primary"
                disabled={busy || dockDraft.trim().length === 0}
                onClick={() => void onSendFollowUp()}
                type="button"
              >
                继续追问
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
