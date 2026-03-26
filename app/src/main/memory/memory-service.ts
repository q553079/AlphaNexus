import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getPeriodFeedbackBundle } from '@main/feedback/feedback-service'
import { getTrainingInsights, getUserProfileSnapshot } from '@main/profile/profile-service'
import type {
  MemoryProposalPayload,
  MemoryUpdateProposal,
} from '@shared/contracts/evaluation'

const getMemoryProposalPath = (paths: LocalFirstPaths) => path.join(paths.dataDir, 'memory-proposals.json')

const loadStoredProposals = async(paths: LocalFirstPaths): Promise<MemoryUpdateProposal[]> => {
  try {
    const content = await readFile(getMemoryProposalPath(paths), 'utf8')
    return JSON.parse(content) as MemoryUpdateProposal[]
  } catch {
    return []
  }
}

const persistProposals = async(paths: LocalFirstPaths, proposals: MemoryUpdateProposal[]) => {
  const filePath = getMemoryProposalPath(paths)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(proposals, null, 2), 'utf8')
}

const buildGeneratedProposals = async(paths: LocalFirstPaths): Promise<MemoryUpdateProposal[]> => {
  const [profile, training, feedback] = await Promise.all([
    getUserProfileSnapshot(paths),
    getTrainingInsights(paths),
    getPeriodFeedbackBundle(paths),
  ])
  const timestamp = new Date().toISOString()
  const proposals: MemoryUpdateProposal[] = []

  if (profile.weaknesses[0]) {
    proposals.push({
      id: 'memory_proposal_mistake_pattern',
      proposal_type: 'mistake-pattern',
      title: '强化常见错误模式记忆',
      summary: profile.weaknesses[0].summary,
      evidence: [profile.weaknesses[0].label],
      status: 'pending',
      created_at: timestamp,
      reviewed_at: null,
    })
  }

  if (feedback.setup_leaderboard[0]) {
    proposals.push({
      id: 'memory_proposal_knowledge_refine',
      proposal_type: 'knowledge-refine',
      title: `补强 setup 知识卡：${feedback.setup_leaderboard[0].label}`,
      summary: '当前 setup 表现最好，建议把关键特征回灌为更明确的 approved knowledge refinement 提案。',
      evidence: [`sample_count=${feedback.setup_leaderboard[0].sample_count}`, `avg_r=${feedback.setup_leaderboard[0].avg_r ?? 'pending'}`],
      status: 'pending',
      created_at: timestamp,
      reviewed_at: null,
    })
  }

  if (training[0]) {
    proposals.push({
      id: 'memory_proposal_rule_adjust',
      proposal_type: 'rule-adjust',
      title: '调整规则优先级',
      summary: training[0].summary,
      evidence: training[0].evidence,
      status: 'pending',
      created_at: timestamp,
      reviewed_at: null,
    })
  }

  return proposals
}

export const listMemoryProposals = async(paths: LocalFirstPaths, status?: MemoryUpdateProposal['status']): Promise<MemoryProposalPayload> => {
  const stored = await loadStoredProposals(paths)
  const generated = await buildGeneratedProposals(paths)
  const merged = new Map<string, MemoryUpdateProposal>()
  for (const proposal of [...generated, ...stored]) {
    merged.set(proposal.id, proposal)
  }
  const proposals = [...merged.values()]
    .filter((proposal) => !status || proposal.status === status)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
  await persistProposals(paths, proposals)
  return { proposals }
}

const updateProposalStatus = async(
  paths: LocalFirstPaths,
  proposalId: string,
  status: MemoryUpdateProposal['status'],
) => {
  const payload = await listMemoryProposals(paths)
  const proposals = payload.proposals.map((proposal) => proposal.id === proposalId
    ? { ...proposal, status, reviewed_at: new Date().toISOString() }
    : proposal)
  await persistProposals(paths, proposals)
  return { proposals }
}

export const approveMemoryProposal = async(paths: LocalFirstPaths, proposalId: string) =>
  updateProposalStatus(paths, proposalId, 'approved')

export const rejectMemoryProposal = async(paths: LocalFirstPaths, proposalId: string) =>
  updateProposalStatus(paths, proposalId, 'rejected')
