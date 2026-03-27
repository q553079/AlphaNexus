import { useEffect, useState } from 'react'
import type { KnowledgeCardPatch, KnowledgeCardView, ReviewKnowledgeCardInput } from './types'

type KnowledgeDraftCardsProps = {
  busy: boolean
  cards: KnowledgeCardView[]
  onReviewCard: (input: ReviewKnowledgeCardInput) => Promise<void>
}

const cardTypeOptions: KnowledgeCardView['card_type'][] = [
  'concept',
  'setup',
  'entry-rule',
  'invalidation-rule',
  'risk-rule',
  'management-rule',
  'mistake-pattern',
  'review-principle',
  'checklist',
]

const joinScope = (items: string[]) => items.join(', ')
const joinTags = (items: string[]) => items.join(', ')

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const toPatch = (draft: {
  card_type: KnowledgeCardView['card_type']
  title: string
  summary: string
  content_md: string
  trigger_conditions_md: string
  invalidation_md: string
  risk_rule_md: string
  contract_scope: string
  timeframe_scope: string
  tags: string
}): KnowledgeCardPatch => ({
  card_type: draft.card_type,
  title: draft.title.trim(),
  summary: draft.summary.trim(),
  content_md: draft.content_md,
  trigger_conditions_md: draft.trigger_conditions_md,
  invalidation_md: draft.invalidation_md,
  risk_rule_md: draft.risk_rule_md,
  contract_scope: parseList(draft.contract_scope),
  timeframe_scope: parseList(draft.timeframe_scope),
  tags: parseList(draft.tags),
})

const DraftCardEditor = ({
  busy,
  card,
  onReviewCard,
}: {
  busy: boolean
  card: KnowledgeCardView
  onReviewCard: KnowledgeDraftCardsProps['onReviewCard']
}) => {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState({
    card_type: card.card_type,
    title: card.title,
    summary: card.summary,
    content_md: card.content_md,
    trigger_conditions_md: card.trigger_conditions_md,
    invalidation_md: card.invalidation_md,
    risk_rule_md: card.risk_rule_md,
    contract_scope: joinScope(card.contract_scope),
    timeframe_scope: joinScope(card.timeframe_scope),
    tags: joinTags(card.tags),
  })

  useEffect(() => {
    setDraft({
      card_type: card.card_type,
      title: card.title,
      summary: card.summary,
      content_md: card.content_md,
      trigger_conditions_md: card.trigger_conditions_md,
      invalidation_md: card.invalidation_md,
      risk_rule_md: card.risk_rule_md,
      contract_scope: joinScope(card.contract_scope),
      timeframe_scope: joinScope(card.timeframe_scope),
      tags: joinTags(card.tags),
    })
  }, [
    card.card_type,
    card.content_md,
    card.contract_scope,
    card.id,
    card.invalidation_md,
    card.risk_rule_md,
    card.summary,
    card.tags,
    card.timeframe_scope,
    card.title,
    card.trigger_conditions_md,
  ])

  return (
    <article className="knowledge-shell__item">
      <div className="knowledge-shell__item-meta">
        <span className="badge">{card.card_type}</span>
        <span className="status-pill">fragment {card.fragment_id}</span>
        <span className="status-pill">draft</span>
      </div>
      <h3 className="knowledge-shell__item-title">{card.title}</h3>
      <p className="workbench-text">{card.summary}</p>
      <div className="knowledge-shell__tags">
        {card.contract_scope.map((scope) => <span className="badge" key={`contract-${card.id}-${scope}`}>{scope}</span>)}
        {card.timeframe_scope.map((scope) => <span className="badge" key={`timeframe-${card.id}-${scope}`}>{scope}</span>)}
        {card.tags.map((tag) => <span className="badge" key={`tag-${card.id}-${tag}`}>{tag}</span>)}
      </div>

      {expanded ? (
        <div className="stack">
          <div className="knowledge-shell__grid">
            <label className="field">
              <span>Card Type</span>
              <select
                className="inline-input"
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, card_type: event.target.value as KnowledgeCardView['card_type'] }))}
                value={draft.card_type}
              >
                {cardTypeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Title</span>
              <input
                className="inline-input"
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                value={draft.title}
              />
            </label>
          </div>
          <label className="field">
            <span>Summary</span>
            <textarea
              className="inline-input"
              disabled={busy}
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
              rows={3}
              value={draft.summary}
            />
          </label>
          <label className="field">
            <span>Content</span>
            <textarea
              className="inline-input knowledge-shell__textarea"
              disabled={busy}
              onChange={(event) => setDraft((current) => ({ ...current, content_md: event.target.value }))}
              rows={8}
              value={draft.content_md}
            />
          </label>
          <div className="knowledge-shell__grid">
            <label className="field">
              <span>Trigger Conditions</span>
              <textarea
                className="inline-input"
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, trigger_conditions_md: event.target.value }))}
                rows={4}
                value={draft.trigger_conditions_md}
              />
            </label>
            <label className="field">
              <span>Invalidation</span>
              <textarea
                className="inline-input"
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, invalidation_md: event.target.value }))}
                rows={4}
                value={draft.invalidation_md}
              />
            </label>
          </div>
          <label className="field">
            <span>Risk Rule</span>
            <textarea
              className="inline-input"
              disabled={busy}
              onChange={(event) => setDraft((current) => ({ ...current, risk_rule_md: event.target.value }))}
              rows={3}
              value={draft.risk_rule_md}
            />
          </label>
          <div className="knowledge-shell__grid">
            <label className="field">
              <span>Contract Scope</span>
              <input
                className="inline-input"
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, contract_scope: event.target.value }))}
                value={draft.contract_scope}
              />
            </label>
            <label className="field">
              <span>Timeframe Scope</span>
              <input
                className="inline-input"
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, timeframe_scope: event.target.value }))}
                value={draft.timeframe_scope}
              />
            </label>
          </div>
          <label className="field">
            <span>Tags</span>
            <input
              className="inline-input"
              disabled={busy}
              onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
              value={draft.tags}
            />
          </label>
        </div>
      ) : (
        <p className="workbench-text">{card.content_md}</p>
      )}

      <div className="action-row">
        <button
          className="button is-primary"
          disabled={busy}
          onClick={() => {
            void onReviewCard({ card_id: card.id, action: 'approve' })
          }}
          type="button"
        >
          Approve
        </button>
        <button
          className="button is-secondary"
          disabled={busy}
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? '收起编辑' : '展开编辑'}
        </button>
        <button
          className="button is-secondary"
          disabled={busy || !draft.title.trim() || !draft.summary.trim() || !draft.content_md.trim()}
          onClick={() => {
            void onReviewCard({
              card_id: card.id,
              action: 'edit-approve',
              edit_payload: toPatch(draft),
            })
          }}
          type="button"
        >
          Edit & Approve
        </button>
        <button
          className="button is-ghost"
          disabled={busy}
          onClick={() => {
            void onReviewCard({ card_id: card.id, action: 'archive' })
          }}
          type="button"
        >
          Archive
        </button>
      </div>
    </article>
  )
}

export const KnowledgeDraftCards = ({ busy, cards, onReviewCard }: KnowledgeDraftCardsProps) => {
  if (cards.length === 0) {
    return <p className="empty-state">没有 draft cards。导入资料后将在这里等待审核。</p>
  }

  return (
    <div className="knowledge-shell__list">
      {cards.map((card) => (
        <DraftCardEditor
          busy={busy}
          card={card}
          key={card.id}
          onReviewCard={onReviewCard}
        />
      ))}
    </div>
  )
}
