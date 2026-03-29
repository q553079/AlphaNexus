import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { PeriodAiReviewPanel } from '@app/features/review/PeriodAiReviewPanel'
import { PeriodKpiGrid } from '@app/features/review/PeriodKpiGrid'
import { PeriodPnlCurvePanel } from '@app/features/review/PeriodPnlCurvePanel'
import { PeriodTagLeaderboardPanel } from '@app/features/review/PeriodTagLeaderboardPanel'
import { PeriodTradeSampleList } from '@app/features/review/PeriodTradeSampleList'
import { buildPeriodReviewViewModel } from '@app/features/review/period-review-view-model'
import { pickPreferredAnalysisProvider } from '@app/features/session-workbench/modules/session-workbench-mappers'
import { TrainingInsightList } from '@app/features/training/TrainingInsightList'
import { translateMarketBias } from '@app/ui/display-text'
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
const translateGenerationStrategy = (value: string) => value === 'rebuild-from-local-records' ? '基于本地记录重建' : value

export const PeriodReviewPage = () => {
  const { periodId } = useParams()
  const [payload, setPayload] = useState<PeriodReviewPayload | null>(null)
  const [targetOptions, setTargetOptions] = useState<CurrentTargetOptionsPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refreshPeriodReview = async(nextPeriodId?: string) => {
    const nextPayload = await alphaNexusApi.workbench.getPeriodReview(nextPeriodId ? { period_id: nextPeriodId } : undefined)
    setPayload(nextPayload)
    const representativeSessionId = nextPayload.sessions[0]?.id ?? nextPayload.period_rollup.session_ids[0]
    if (!representativeSessionId) {
      setTargetOptions(null)
      return nextPayload
    }

    const nextTargetOptions = await alphaNexusApi.workbench.listTargetOptions({
      session_id: representativeSessionId,
      include_period_targets: true,
    })
    setTargetOptions(nextTargetOptions)
    return nextPayload
  }

  useEffect(() => {
    void refreshPeriodReview(periodId).catch((error) => {
      setPayload(null)
      setTargetOptions(null)
      setMessage(error instanceof Error ? `周期复盘加载失败：${error.message}` : '周期复盘加载失败。')
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
      await refreshPeriodReview(payload.period.id)
      setMessage(`已将内容块“${block.title}”改挂载到 ${option.label}。`)
    } catch (error) {
      setMessage(error instanceof Error ? `改挂载失败：${error.message}` : '改挂载内容块失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleRunPeriodReview = async() => {
    if (!payload) {
      return
    }

    const representativeSessionId = payload.sessions[0]?.id ?? payload.period_rollup.session_ids[0]
    if (!representativeSessionId) {
      setMessage('当前周期还没有可用于 AI 周/月复盘的 Session。')
      return
    }

    try {
      setBusy(true)
      const providers = await alphaNexusApi.ai.listProviders()
      const preferredProvider = pickPreferredAnalysisProvider(providers)
      if (!preferredProvider) {
        throw new Error('当前没有已启用且已配置完成的 AI 模型提供方。')
      }

      const result = await alphaNexusApi.ai.runAnalysis({
        session_id: representativeSessionId,
        period_id: payload.period.id,
        provider: preferredProvider.provider,
        prompt_kind: 'period-review',
      })
      await refreshPeriodReview(payload.period.id)
      setMessage(`${preferredProvider.label} 周期复盘已生成：${result.analysis_card.summary_short}`)
    } catch (error) {
      setMessage(error instanceof Error ? `生成周期复盘失败：${error.message}` : '生成周期复盘失败。')
    } finally {
      setBusy(false)
    }
  }

  if (!payload) {
    return <div className="empty-state">正在加载周期复盘...</div>
  }

  const {
    bestTrades,
    worstTrades,
    mistakeTags,
    highlightCards,
    hasMeaningfulData: hasPayloadEvidence,
  } = buildPeriodReviewViewModel(payload)
  const hasMeaningfulData = hasPayloadEvidence || hasProfileData(payload.profile_snapshot)

  return (
    <div className="stack">
      <PageHeading
        eyebrow="周期复盘"
        summary="当前页面直接读取主进程聚合出的周期汇总、交易指标、标签汇总与 AI 质量摘要，页面本身不再拼业务聚合。"
        title={`${payload.period.label} 复盘`}
        actions={(
          <>
            <button className="button is-secondary" disabled={busy} onClick={handleRunPeriodReview} type="button">
              生成 AI 周/月复盘
            </button>
            <span className="status-pill">结构化成功率 {formatPct(payload.ai_quality_summary.success_rate_pct)}</span>
          </>
        )}
      />
      {message ? <div className="status-inline">{message}</div> : null}

      {hasMeaningfulData ? (
        <>
          <SectionCard title="关键指标" subtitle="使用真实周期汇总的统计字段，而不是页面临时计算。">
            <PeriodKpiGrid rollup={payload.period_rollup} />
          </SectionCard>

          <div className="two-column">
            <SectionCard title="盈亏曲线" subtitle="按真实已平仓交易顺序累计盈亏 R。">
              <PeriodPnlCurvePanel points={payload.period_rollup.pnl_curve} />
            </SectionCard>

            <SectionCard title="AI 周期行动项" subtitle="只展示周期复盘结构化结果与质量摘要，不覆盖交易事实。">
              <PeriodAiReviewPanel
                aiQuality={payload.ai_quality_summary}
                aiReview={payload.latest_period_ai_review}
                busy={busy}
                onGenerate={handleRunPeriodReview}
              />
            </SectionCard>
          </div>

          <div className="two-column">
            <SectionCard title="形态排行" subtitle="形态榜来自真实交易指标，而不是只看工作过程标签。">
              <SetupLeaderboardPanel entries={payload.setup_leaderboard} />
            </SectionCard>

            <SectionCard title="错误标签排行" subtitle="按标签类别与来源保留用户、系统和 AI 区分。">
              <PeriodTagLeaderboardPanel items={mistakeTags} />
            </SectionCard>
          </div>

          <div className="two-column">
            <SectionCard title="最佳交易列表" subtitle="可直接下钻回交易或工作过程。">
              <PeriodTradeSampleList metrics={bestTrades} />
            </SectionCard>

            <SectionCard title="最差交易列表" subtitle="保留交易编号、工作过程编号和计划或 AI 对齐度，便于解释问题来源。">
              <PeriodTradeSampleList metrics={worstTrades} />
            </SectionCard>
          </div>

          <div className="two-column">
            <SectionCard title="重点摘要卡" subtitle="只取市场分析卡，避免周期复盘占位卡污染主线。">
              {highlightCards.length > 0 ? (
                <div className="stack">
                  {highlightCards.map((card) => (
                    <AnalysisCardView card={card} key={card.id} />
                  ))}
                </div>
              ) : <div className="empty-state">当前没有可用的重点摘要卡。</div>}
            </SectionCard>

            <SectionCard title="周期工作过程轨迹" subtitle="支持从周期结果反查到底层工作过程样本。">
              {payload.sessions.length > 0 ? (
                <div className="compact-list">
                  {payload.sessions.map((session) => (
                    <article className="compact-list__item" key={session.id}>
                      <div className="action-row">
                        <Link className="button is-secondary" to={`/sessions/${session.id}`}>打开工作过程</Link>
                        <span className="status-pill">{sessionStatusLabels[session.status]}</span>
                        <span className="status-pill">{translateMarketBias(session.market_bias)}</span>
                      </div>
                      <strong>{session.title}</strong>
                      <p>{excerpt(session.context_focus || session.my_realtime_view, '当前工作过程还没有实时观点或关注点记录。')}</p>
                      <p>{session.started_at}</p>
                    </article>
                  ))}
                </div>
              ) : <div className="empty-state">当前周期还没有工作过程。</div>}
            </SectionCard>
          </div>

          <div className="two-column">
            <SectionCard title="评估与校准" subtitle="闭环数量、AI 与人工对比以及校准结果继续读取真实评估汇总。">
              <PeriodEvaluationPanel rollup={payload.evaluation_rollup} />
            </SectionCard>

            <SectionCard title="高频规则命中" subtitle="规则命中保持在主进程服务侧聚合，不落到页面里计算。">
              <RuleRollupPanel items={payload.rule_rollup} />
            </SectionCard>
          </div>

          <div className="two-column">
            <SectionCard title="自动反馈摘要" subtitle="基于本周期真实交易、评估和 AI 证据生成少量可执行建议。">
              <FeedbackList emptyMessage="当前没有周期级反馈。" items={payload.feedback_items} />
            </SectionCard>

            <SectionCard title="训练建议" subtitle="这一层只提出训练方向，不会自动改知识卡或规则。">
              <TrainingInsightList insights={payload.training_insights} />
            </SectionCard>
          </div>

          <div className="two-column">
            <SectionCard title="用户画像快照" subtitle="只展示从真实周期证据聚合出来的强项、弱项和 AI 协同倾向。">
              <UserProfilePanel profile={payload.profile_snapshot} />
            </SectionCard>

            <SectionCard title="周期统计来源" subtitle="周期标识、交易编号与 AI 引用位都已经落成正式周期汇总。">
              <div className="compact-list">
                <article className="compact-list__item">
                  <strong>{payload.period_rollup.period_key}</strong>
                  <div className="action-row">
                    <span className="status-pill">工作过程 {payload.period_rollup.session_ids.length}</span>
                    <span className="status-pill">交易 {payload.period_rollup.trade_ids.length}</span>
                    <span className="status-pill">AI 复盘 {payload.period_rollup.latest_period_review_ai_run_id ?? '待生成'}</span>
                  </div>
                  <p>{translateGenerationStrategy(payload.period_rollup.generation_strategy)}</p>
                </article>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="周期级内容块" subtitle="周期复盘文本块仍然可以改挂载到工作过程、交易或周期。">
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
              <div className="empty-state">当前没有周期级内容块。</div>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard title="当前周期暂无聚合结果">
          <div className="empty-state">当前周期还没有可用于复盘的工作过程、交易、AI 分析或评估记录。</div>
        </SectionCard>
      )}
    </div>
  )
}
