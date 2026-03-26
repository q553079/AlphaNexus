import { useEffect, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import { AIProviderList } from '@app/features/integrations/AIProviderList'
import { MemoryProposalReviewPanel } from '@app/features/memory/MemoryProposalReviewPanel'
import { RankingExplanationPanel } from '@app/features/profile/RankingExplanationPanel'
import { UserProfilePanel } from '@app/features/profile/UserProfilePanel'
import { TrainingInsightList } from '@app/features/training/TrainingInsightList'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import type { EnvironmentInfo } from '@shared/contracts/workbench'
import type { MemoryUpdateProposal, RankingExplanationPayload, TrainingInsight, UserProfile } from '@shared/contracts/evaluation'

export const SettingsAiPage = () => {
  const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [trainingInsights, setTrainingInsights] = useState<TrainingInsight[]>([])
  const [rankingPayload, setRankingPayload] = useState<RankingExplanationPayload>({ explanations: [] })
  const [memoryProposals, setMemoryProposals] = useState<MemoryUpdateProposal[]>([])
  const [busy, setBusy] = useState(false)

  const refreshLearningState = async() => {
    const [nextProfile, nextTraining, nextRanking, nextMemory] = await Promise.all([
      alphaNexusApi.workbench.getUserProfile(),
      alphaNexusApi.workbench.getTrainingInsights(),
      alphaNexusApi.workbench.getRankingExplanations(),
      alphaNexusApi.workbench.listMemoryProposals(),
    ])

    setProfile(nextProfile)
    setTrainingInsights(nextTraining)
    setRankingPayload(nextRanking)
    setMemoryProposals(nextMemory.proposals)
  }

  useEffect(() => {
    void Promise.all([
      alphaNexusApi.app.getEnvironment().then(setEnvironment),
      refreshLearningState(),
    ])
  }, [])

  const handleReviewProposal = (proposalId: string, action: 'approve' | 'reject') => {
    void (async() => {
      try {
        setBusy(true)
        const nextPayload = action === 'approve'
          ? await alphaNexusApi.workbench.approveMemoryProposal({ proposal_id: proposalId })
          : await alphaNexusApi.workbench.rejectMemoryProposal({ proposal_id: proposalId })
        setMemoryProposals(nextPayload.proposals)
      } finally {
        setBusy(false)
      }
    })()
  }

  return (
    <div className="stack">
      <PageHeading
        eyebrow="集成"
        summary="这里集中管理本地 AI 提供方开关、模型选择、第三方 OpenAI-compatible URL / key、排序解释、画像快照和 memory proposal 审核，不在仓库中保存真实密钥。"
        title="AI 提供方设置"
      />

      <SectionCard title="本地环境">
        <div className="two-column">
          <div className="compact-list__item">
            <strong>数据目录</strong>
            <p>{environment?.dataDir ?? '加载中...'}</p>
          </div>
          <div className="compact-list__item">
            <strong>Vault 目录</strong>
            <p>{environment?.vaultDir ?? '加载中...'}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="提供方列表">
        <AIProviderList />
      </SectionCard>

      <div className="two-column">
        <SectionCard title="用户画像快照" subtitle="只展示由历史 trade / evaluation 证据聚合出来的结构化画像。">
          <UserProfilePanel profile={profile} />
        </SectionCard>

        <SectionCard title="训练建议" subtitle="训练闭环当前只输出建议，不会自动改写正式知识或规则。">
          <TrainingInsightList insights={trainingInsights} />
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title="排序解释" subtitle="个性化排序保持可解释，不使用黑箱权重。">
          <RankingExplanationPanel payload={rankingPayload} />
        </SectionCard>

        <SectionCard title="长期记忆提案审核" subtitle="memory update proposal 必须经过人工审批后才会进入下一步。">
          <MemoryProposalReviewPanel
            busy={busy}
            onApprove={(proposalId) => {
              handleReviewProposal(proposalId, 'approve')
            }}
            onReject={(proposalId) => {
              handleReviewProposal(proposalId, 'reject')
            }}
            proposals={memoryProposals}
          />
        </SectionCard>
      </div>
    </div>
  )
}
