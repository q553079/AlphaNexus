import type { MemoryUpdateProposal } from '@shared/contracts/evaluation'

type MemoryProposalReviewPanelProps = {
  busy: boolean
  proposals: MemoryUpdateProposal[]
  onApprove: (proposalId: string) => void
  onReject: (proposalId: string) => void
}

export const MemoryProposalReviewPanel = ({
  busy,
  proposals,
  onApprove,
  onReject,
}: MemoryProposalReviewPanelProps) => {
  if (proposals.length === 0) {
    return <div className="empty-state">当前没有待审核的 memory proposals。</div>
  }

  return (
    <div className="compact-list">
      {proposals.map((proposal) => (
        <article className="compact-list__item" key={proposal.id}>
          <strong>{proposal.title}</strong>
          <p>{proposal.summary}</p>
          <div className="action-row">
            <span className="status-pill">{proposal.proposal_type}</span>
            <span className="status-pill">{proposal.status}</span>
            {proposal.evidence.slice(0, 3).map((evidence) => (
              <span className="badge" key={evidence}>{evidence}</span>
            ))}
          </div>
          {proposal.status === 'pending' ? (
            <div className="action-row">
              <button className="button is-primary" disabled={busy} onClick={() => onApprove(proposal.id)} type="button">
                Approve
              </button>
              <button className="button is-secondary" disabled={busy} onClick={() => onReject(proposal.id)} type="button">
                Reject
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}
