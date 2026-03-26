import type { SessionWorkbenchPayload } from '@shared/contracts/workbench'

const sessionStatusLabels = {
  planned: '计划中',
  active: '进行中',
  closed: '已关闭',
} as const

const eventTypeLabels = {
  observation: '观察',
  thesis: '观点',
  trade_open: '开仓',
  trade_close: '平仓',
  screenshot: '截图',
  ai_summary: 'AI 摘要',
  review: '复盘',
} as const

export const buildSessionMarkdown = (payload: SessionWorkbenchPayload) => {
  const events = payload.events
    .map((event) => `## ${event.title}\n\n- 时间：${event.occurred_at}\n- 类型：${eventTypeLabels[event.event_type]}\n- 摘要：${event.summary}`)
    .join('\n\n')
  const notes = payload.content_blocks
    .filter((block) => !block.soft_deleted)
    .filter((block) => !(block.context_type === 'session' && block.context_id === payload.session.id && block.title === 'Realtime view'))
    .map((block) => `### ${block.title}\n\n${block.content_md}`)
  .join('\n\n')
  const images = payload.screenshots.map((shot) => `![${shot.caption ?? shot.id}](${shot.file_path})`).join('\n\n')

  return [
    `# ${payload.session.title}`,
    '',
    `- 合约：${payload.contract.symbol} (${payload.contract.name})`,
    `- 周期：${payload.period.label}`,
    `- Session 状态：${sessionStatusLabels[payload.session.status]}`,
    '',
    '## 我的实时看法',
    '',
    payload.panels.my_realtime_view,
    '',
    '## AI 摘要',
    '',
    payload.panels.ai_summary,
    '',
    '## 交易计划',
    '',
    payload.panels.trade_plan,
    '',
    '## 事件流',
    '',
    events,
    '',
    '## 笔记',
    '',
    notes,
    '',
    '## 图片',
    '',
    images,
  ].join('\n')
}
