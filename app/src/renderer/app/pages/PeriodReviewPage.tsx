import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { alphaNexusApi } from '@app/bootstrap/api'
import { AnalysisCardView } from '@app/components/AnalysisCardView'
import { PageHeading } from '@app/components/PageHeading'
import { SectionCard } from '@app/components/SectionCard'
import { ContentBlockTargetManager } from '@app/features/context/ContentBlockTargetManager'
import { PeriodEvaluationPanel } from '@app/features/evaluation/PeriodEvaluationPanel'
import { RuleRollupPanel } from '@app/features/evaluation/RuleRollupPanel'
import { SetupLeaderboardPanel } from '@app/features/leaderboard/SetupLeaderboardPanel'
import { UserProfilePanel } from '@app/features/profile/UserProfilePanel'
import { FeedbackList } from '@app/features/review/FeedbackList'
import { TrainingInsightList } from '@app/features/training/TrainingInsightList'
import type { CurrentTargetOptionsPayload, PeriodReviewPayload } from '@shared/contracts/workbench'

const hasProfileData = (profile: PeriodReviewPayload['profile_snapshot']) => Boolean(
  profile
  && [
    ...profile.strengths,
    ...profile.weaknesses,
    ...profile.execution_style,
    ...profile.ai_collaboration,
  ].some((item) => item.count > 0),
)

const sessionStatusLabels = {
  planned: '计划中',
  active: '进行中',
  closed: '已关闭',
} as const

const compact = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const excerpt = (value: string | null | undefined, fallback: string) => {
  const trimmed = compact(value)
  if (!trimmed) {
    return fallback
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed
}

const formatPct = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}%`

const formatR = (value: number | null | undefined) => value === null || value === undefined ? '待补充' : `${value}R`

export const PeriodReviewPage = () => {
  const { periodId } = useParams()
  const [payload, setPayload] = useState<PeriodReviewPayload | null>(null)
  const [targetOptions, setTargetOptions] = useState<CurrentTargetOptionsPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void alphaNexusApi.workbench.getPeriodReview(periodId ? { period_id: periodId } : undefined).then((nextPayload) => {
      setPayload(nextPayload)
      const representativeSessionId = nextPayload.sessions[0]?.id
      if (!representativeSessionId) {
        setTargetOptions(null)
        return
      }

      return alphaNexusApi.workbench.listTargetOptions({
        session_id: representativeSessionId,
        include_period_targets: true,
      }).then(setTargetOptions)
    }).catch(() => {
      setTargetOptions(null)
    })
  }, [periodId])

  const handleMoveContentBlock = async(
    block: PeriodReviewPayload['content_blocks'][number],
    option: NonNullable<CurrentTargetOptionsPayload>['options'][number],
  ) => {
    if (!payload) {
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.workbench.moveContentBlock({
        block_id: block.id,
        target_kind: option.target_kind,
        session_id: option.session_id,
        period_id: option.target_kind === 'period' ? option.period_id : undefined,
        trade_id: option.target_kind === 'trade' ? option.trade_id ?? null : null,
      })
      const nextPayload = await alphaNexusApi.workbench.getPeriodReview({ period_id: payload.period.id })
      setPayload(nextPayload)
      setMessage(`已将内容块“${block.title}”改挂载到 ${option.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `改挂载失败：${error.message}` : '改挂载内容块失败。')
    } finally {
      setBusy(false)
    }
  }

  if (!payload) {
    return <div className="empty-state">正在加载周期复盘...</div>
  }

  const highlightCards = payload.highlight_cards.slice(0, 3)
  const strongestSetup = payload.setup_leaderboard[0] ?? null
  const topFeedback = payload.feedback_items[0] ?? null
  const topRule = payload.rule_rollup[0] ?? null
  const topTraining = payload.training_insights[0] ?? null
  const topKnowledge = payload.evaluation_rollup.effective_knowledge[0] ?? null
  const directionMetric = payload.evaluation_rollup.ai_vs_human.find((metric) => metric.id === 'direction_hit')
    ?? payload.evaluation_rollup.ai_vs_human[0]
    ?? null
  const narrativeItems = [
    {
      id: 'period_progress',
      eyebrow: '闭环进度',
      title: `${payload.evaluation_rollup.evaluated_count} 笔已闭环 / ${payload.evaluation_rollup.pending_count} 笔待确认`,
      summary: '这条线来自 trades、events 和 AI 记录，而不是页面占位数据。',
    },
    strongestSetup ? {
      id: 'period_setup',
      eyebrow: '主 setup',
      title: strongestSetup.label,
      summary: `样本 ${strongestSetup.sample_count}，胜率 ${formatPct(strongestSetup.win_rate_pct)}，avg R ${formatR(strongestSetup.avg_r)}。`,
    } : null,
    topFeedback ? {
      id: 'period_feedback',
      eyebrow: '主偏差',
      title: topFeedback.title,
      summary: topFeedback.summary,
    } : null,
    topRule ? {
      id: 'period_rule',
      eyebrow: '纪律缺口',
      title: topRule.label,
      summary: `${topRule.summary} 当前命中率 ${formatPct(topRule.match_rate_pct)}。`,
    } : null,
    topKnowledge ? {
      id: 'period_knowledge',
      eyebrow: '有效知识',
      title: topKnowledge.title,
      summary: `命中 ${topKnowledge.hit_count} 次，质量分 ${topKnowledge.quality_score_pct}%。`,
    } : null,
    topTraining ? {
      id: 'period_training',
      eyebrow: '下一步训练',
      title: topTraining.title,
      summary: topTraining.summary,
    } : null,
  ].filter((item): item is {
    id: string
    eyebrow: string
    title: string
    summary: string
  } => item !== null)
  const hasMeaningfulData = payload.sessions.length > 0
    || highlightCards.length > 0
    || payload.evaluations.length > 0
    || payload.evaluation_rollup.evaluated_count > 0
    || payload.evaluation_rollup.pending_count > 0
    || payload.feedback_items.length > 0
    || payload.rule_rollup.length > 0
    || payload.setup_leaderboard.length > 0
    || hasProfileData(payload.profile_snapshot)
    || payload.training_insights.length > 0

  return (
    <div className="stack">
      <PageHeading
        eyebrow="周期复盘"
        summary="周期页继续与 Session 写入链路分离，但现在优先展示来自真实 session / trade / AI / evaluation 记录的聚合结果。"
        title={`${payload.period.label} 复盘`}
      />
      {message ? <div className="status-inline">{message}</div> : null}

      {hasMeaningfulData ? (
        <>
          <div className="two-column">
            <SectionCard title="周期主线" subtitle="把 setup、纪律、AI 和训练提示先压成一条真实可读的周期骨架。">
              <div className="compact-list">
                {narrativeItems.map((item) => (
                  <div className="compact-list__item" key={item.id}>
                    <span className="eyebrow">{item.eyebrow}</span>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="重点摘要卡" subtitle="优先挑 trade-linked 且置信度更高的 AI 卡片，方便先抓住本周期的关键决策。">
              {highlightCards.length > 0 ? (
                <div className="stack">
                  {highlightCards.map((card) => (
                    <AnalysisCardView card={card} key={card.id} />
                  ))}
                </div>
              ) : <div className="empty-state">当前没有可用的 highlight card。</div>}
            </SectionCard>
          </div>

          <div className="two-column">
            <SectionCard title="Session Story" subtitle="按时间看本周期的 sessions，而不是只看聚合指标。">
              {payload.sessions.length > 0 ? (
                <div className="compact-list">
                  {payload.sessions.map((session) => (
                    <div className="compact-list__item" key={session.id}>
                      <strong>{session.title}</strong>
                      <p>{excerpt(session.context_focus || session.my_realtime_view, '当前 Session 还没有 realtime view / focus 记录。')}</p>
                      <p>
                        {sessionStatusLabels[session.status]}
                        {' · '}
                        {session.market_bias}
                        {session.tags[0] ? ` · ${session.tags[0]}` : ''}
                        {' · '}
                        {session.started_at}
                      </p>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state">当前周期还没有 Session。</div>}
            </SectionCard>

            <SectionCard title="评估与校准" subtitle="先看闭环数量、AI vs Human 与 calibration，再决定这周应该相信哪条信号。">
              <div className="compact-list">
                <div className="compact-list__item">
                  <strong>已闭环 {payload.evaluation_rollup.evaluated_count} 笔</strong>
                  <p>待确认 {payload.evaluation_rollup.pending_count} 笔。没有闭环的样本不会被伪装成“看起来很完整”的复盘结果。</p>
                </div>
                {directionMetric ? (
                  <div className="compact-list__item">
                    <strong>{directionMetric.label}</strong>
                    <p>AI {formatPct(directionMetric.ai_value_pct)} / Human {formatPct(directionMetric.human_value_pct)} / Delta {directionMetric.delta_pct ?? '待补充'}%</p>
                  </div>
                ) : null}
              </div>
              <PeriodEvaluationPanel rollup={payload.evaluation_rollup} />
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
            <SectionCard title="Setup 表现榜" subtitle="同时看样本量、胜率、avg R 和 discipline。">
              <SetupLeaderboardPanel entries={payload.setup_leaderboard} />
            </SectionCard>

            <SectionCard title="用户画像快照" subtitle="只展示从历史证据聚合出来的强项、弱项和协同倾向。">
              <UserProfilePanel profile={payload.profile_snapshot} />
            </SectionCard>
          </div>

          <SectionCard title="Period 级内容块" subtitle="可把周期复盘里的 markdown 块重新挂载回 session / trade / period。">
            {payload.content_blocks.length > 0 ? (
              <div className="compact-list">
                {payload.content_blocks.map((block) => (
                  <div className="compact-list__item" key={block.id}>
                    <strong>{block.title}</strong>
                    <div className="workbench-text">{block.content_md}</div>
                    <ContentBlockTargetManager
                      block={block}
                      busy={busy}
                      onMove={handleMoveContentBlock}
                      targetPayload={targetOptions}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">当前没有 period 级内容块。</div>
            )}
          </SectionCard>

          <SectionCard title="训练建议" subtitle="这一层只提出训练方向，不会自动修改知识卡或规则。">
            <TrainingInsightList insights={payload.training_insights} />
          </SectionCard>
        </>
      ) : (
        <SectionCard title="当前周期暂无聚合结果">
          <div className="empty-state">当前周期还没有可用于复盘的 Session、Trade、AI 分析或评估记录。</div>
        </SectionCard>
      )}
    </div>
  )
}
