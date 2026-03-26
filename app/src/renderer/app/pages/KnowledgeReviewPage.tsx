import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import {
  KnowledgeApprovedCards,
  KnowledgeDraftCards,
  KnowledgeFragmentList,
  KnowledgeSourceIngestCard,
  useKnowledgeReviewShell,
} from '@app/features/knowledge'

export const KnowledgeReviewPage = () => {
  const knowledge = useKnowledgeReviewShell()

  return (
    <div className="stack knowledge-shell">
      <PageHeading
        eyebrow="Knowledge Review"
        summary="导入资料、检查分块、审核 draft cards，并让运行时只消费 approved knowledge。"
        title="Knowledge Review MVP"
      />

      {knowledge.errorMessage ? <div className="status-inline">{knowledge.errorMessage}</div> : null}
      {knowledge.infoMessage ? <div className="status-inline">{knowledge.infoMessage}</div> : null}
      {!knowledge.apiAvailable ? (
        <div className="empty-state">当前是 UI Shell 模式。主控接入 `knowledge` API 后即可联调。</div>
      ) : null}

      <SectionCard subtitle="本地导入 source，并由后端生成 fragment 与 draft cards。" title="Source">
        <KnowledgeSourceIngestCard busy={knowledge.busy} onSubmit={knowledge.ingestSource} />
      </SectionCard>

      <SectionCard subtitle="展示来源分块结果，便于核对追溯。" title="Fragments">
        <KnowledgeFragmentList fragments={knowledge.dashboard.fragments} />
      </SectionCard>

      <SectionCard subtitle="审核动作仅作用于 draft，不直接污染运行时。" title="Draft Cards">
        <KnowledgeDraftCards busy={knowledge.busy} cards={knowledge.dashboard.draft_cards} onReviewCard={knowledge.reviewCard} />
      </SectionCard>

      <SectionCard subtitle="运行时仅可见 approved cards。" title="Approved Cards">
        <KnowledgeApprovedCards cards={knowledge.dashboard.approved_cards} />
      </SectionCard>
    </div>
  )
}
