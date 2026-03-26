import { formatDateTime, translateContextType } from '@app/ui/display-text'
import type { ContentBlockMoveAuditRecord, ContentBlockRecord } from '@shared/contracts/content'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'
import { TargetSelector } from './TargetSelector'

type TargetSelectorData = Pick<CurrentTargetOptionsPayload, 'current_context' | 'options' | 'groups'>

type ContentBlockTargetManagerProps = {
  block: ContentBlockRecord
  busy: boolean
  onMove: (block: ContentBlockRecord, option: CurrentTargetOption) => void
  targetPayload: TargetSelectorData | null
}

const resolveOptionForContext = (
  targetPayload: TargetSelectorData | null,
  input: {
    context_type: ContentBlockRecord['context_type']
    context_id: string
  },
) => {
  if (!targetPayload) {
    return null
  }

  if (input.context_type === 'session') {
    return targetPayload.options.find((option) => option.target_kind === 'session' && option.session_id === input.context_id) ?? null
  }

  if (input.context_type === 'trade') {
    return targetPayload.options.find((option) => option.target_kind === 'trade' && option.trade_id === input.context_id) ?? null
  }

  if (input.context_type === 'period') {
    return targetPayload.options.find((option) => option.target_kind === 'period' && option.period_id === input.context_id) ?? null
  }

  return null
}

const formatContextLabel = (
  targetPayload: TargetSelectorData | null,
  input: {
    context_type: ContentBlockMoveAuditRecord['from_context_type'] | ContentBlockRecord['context_type']
    context_id: string
  },
) => {
  const matchedOption = resolveOptionForContext(targetPayload, input)
  if (matchedOption) {
    return `${translateContextType(input.context_type)} · ${matchedOption.label}`
  }

  return `${translateContextType(input.context_type)} · ${input.context_id}`
}

const canMoveBlock = (block: ContentBlockRecord) =>
  block.block_type !== 'ai-summary' && block.title !== 'Realtime view'

export const ContentBlockTargetManager = ({
  block,
  busy,
  onMove,
  targetPayload,
}: ContentBlockTargetManagerProps) => {
  const currentOption = resolveOptionForContext(targetPayload, {
    context_type: block.context_type,
    context_id: block.context_id,
  })

  return (
    <div className="content-target-manager">
      <div className="content-target-manager__summary">
        <p className="content-target-manager__eyebrow">Current Mount</p>
        <strong>{currentOption?.label ?? formatContextLabel(targetPayload, block)}</strong>
        <p className="content-target-manager__subtitle">
          {currentOption?.subtitle ?? '当前内容块仍挂在原始事件或未收录的目标上。'}
        </p>
      </div>

      {canMoveBlock(block) && targetPayload ? (
        <TargetSelector
          busy={busy}
          emptyMessage="当前没有可用于改挂载的目标。"
          label="改挂载目标"
          onSelect={(option) => onMove(block, option)}
          selectedOptionId={currentOption?.id ?? null}
          targetPayload={targetPayload}
          variant="compact"
        />
      ) : canMoveBlock(block) ? (
        <p className="content-target-manager__subtitle">正在加载可用目标。</p>
      ) : (
        <p className="content-target-manager__subtitle">当前块类型不支持改挂载。</p>
      )}

      {block.move_history.length > 0 ? (
        <details className="content-target-manager__history">
          <summary>移动历史 {block.move_history.length}</summary>
          <div className="content-target-manager__history-list">
            {block.move_history.map((entry) => (
              <article className="content-target-manager__history-item" key={entry.id}>
                <strong>{formatContextLabel(targetPayload, {
                  context_type: entry.from_context_type,
                  context_id: entry.from_context_id,
                })} → {formatContextLabel(targetPayload, {
                  context_type: entry.to_context_type,
                  context_id: entry.to_context_id,
                })}</strong>
                <p>{formatDateTime(entry.moved_at)}</p>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}
