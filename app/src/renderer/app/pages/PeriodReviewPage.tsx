import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { alphaNexusApi } from '@app/bootstrap/api'
import { AnalysisCardView } from '@app/components/AnalysisCardView'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import { PeriodEvaluationPanel } from '@app/features/evaluation/PeriodEvaluationPanel'
import { RuleRollupPanel } from '@app/features/evaluation/RuleRollupPanel'
import { SetupLeaderboardPanel } from '@app/features/leaderboard/SetupLeaderboardPanel'
import { UserProfilePanel } from '@app/features/profile/UserProfilePanel'
import { FeedbackList } from '@app/features/review/FeedbackList'
import { TrainingInsightList } from '@app/features/training/TrainingInsightList'
import type { PeriodReviewPayload } from '@shared/contracts/workbench'

export const PeriodReviewPage = () => {
  const { periodId } = useParams()
  const [payload, setPayload] = useState<PeriodReviewPayload | null>(null)

  useEffect(() => {
    void alphaNexusApi.workbench.getPeriodReview(periodId ? { period_id: periodId } : undefined).then(setPayload)
  }, [periodId])

  return payload ? (
    <div className="stack">
      <PageHeading
        eyebrow="周期复盘"
        summary="周度和月度聚合继续与 Session 写入链路分离，但页面已经接好摘要卡片和评估汇总。"
        title={`${payload.period.label} 复盘`}
      />

      <div className="two-column">
        <SectionCard title="周期内 Sessions">
          <div className="compact-list">
            {payload.sessions.map((session) => (
              <div className="compact-list__item" key={session.id}>
                <strong>{session.title}</strong>
                <p>{session.my_realtime_view}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="重点摘要卡">
          {payload.highlight_cards[0]
            ? <AnalysisCardView card={payload.highlight_cards[0]} />
            : <div className="empty-state">当前没有 highlight card。</div>}
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title="评估与校准" subtitle="Calibration、AI vs Human、错误模式与有效知识卡。">
          <PeriodEvaluationPanel rollup={payload.evaluation_rollup} />
        </SectionCard>

        <SectionCard title="Setup 表现榜" subtitle="同时看样本量、胜率、avg R 和 discipline。">
          <SetupLeaderboardPanel entries={payload.setup_leaderboard} />
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title="自动反馈摘要" subtitle="基于 review insights 聚合出来的少量可执行建议。">
          <FeedbackList emptyMessage="当前没有周期级反馈。" items={payload.feedback_items} />
        </SectionCard>

        <SectionCard title="高频规则命中" subtitle="透明规则引擎的周期聚合，便于看哪条纪律最容易掉线。">
          <RuleRollupPanel items={payload.rule_rollup} />
        </SectionCard>
      </div>

      <div className="two-column">
        <SectionCard title="用户画像快照" subtitle="只展示从历史证据聚合出来的强项、弱项和协同倾向。">
          <UserProfilePanel profile={payload.profile_snapshot} />
        </SectionCard>
      </div>

      <SectionCard title="训练建议" subtitle="这一层只提出训练方向，不会自动修改知识卡或规则。">
        <TrainingInsightList insights={payload.training_insights} />
      </SectionCard>
    </div>
  ) : <div className="empty-state">正在加载周期复盘...</div>
}
