import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFollowUpContext,
  buildScreenshotAiThread,
} from '../../src/renderer/app/features/session-workbench/modules/session-screenshot-ai-thread.ts'

test('screenshot AI thread follow-up metadata stays parseable for user turns and attachments', async() => {
  const followUpContext = buildFollowUpContext({
    aiReply: {
      aiRun: {
        provider: 'deepseek',
      },
      card: {
        summary_short: '回踩支撑后看延续',
        bias: 'bullish',
        entry_zone: '21932-21945',
        stop_loss: '21908 下方',
        take_profit: '21988 / 22020',
        invalidation: '跌破 21908 并延续',
      },
    },
    followUpQuestion: '说一下 B1-B3 哪边支撑较强？',
    noteDraft: 'B2 一带承接更稳定。',
    titleDraft: '开盘回踩图',
    attachments: [{
      id: 'attach_image_1',
      kind: 'image',
      name: 'extra-chart.png',
      mime_type: 'image/png',
      size_bytes: 1204,
      data_url: 'data:image/png;base64,abc',
      text_excerpt: null,
    }, {
      id: 'attach_doc_1',
      kind: 'document',
      name: 'plan.md',
      mime_type: 'text/markdown',
      size_bytes: 512,
      text_excerpt: '如果 B2 被击穿，则只看下方承接，不追多。',
    }],
  })

  assert.match(followUpContext, /\[ALPHA_NEXUS_USER_QUESTION\]/)
  assert.match(followUpContext, /\[ALPHA_NEXUS_ATTACHMENTS\]/)

  const turns = buildScreenshotAiThread({
    screenshot: {
      id: 'shot_1',
      caption: '事件图 1',
      asset_url: 'file:///shot_1.png',
      raw_asset_url: 'file:///shot_1_raw.png',
      annotated_asset_url: 'file:///shot_1_annotated.png',
    },
    aiReplies: [{
      aiEvent: {
        id: 'event_ai_1',
        occurred_at: '2026-03-28T10:20:00.000Z',
        ai_run_id: 'airun_1',
      },
      aiRun: {
        id: 'airun_1',
        provider: 'deepseek',
        prompt_preview: `
Mount target session: 3月25日上午工作过程
Background note:
${followUpContext}

User realtime view:
B2 一带承接更稳定。
        `.trim(),
      },
      card: {
        id: 'card_1',
        ai_run_id: 'airun_1',
        bias: 'bullish',
        confidence_pct: 75,
        summary_short: 'B2 支撑强于 B1 和 B3。',
        deep_analysis_md: 'B2 在回踩与量能衰减上更完整。',
      },
    }],
  })

  assert.equal(turns.length, 1)
  assert.equal(turns[0].user_text, '说一下 B1-B3 哪边支撑较强？')
  assert.equal(turns[0].user_attachments.length, 3)
  assert.equal(turns[0].user_attachments[0].is_primary_screenshot, true)
  assert.equal(turns[0].user_attachments[1].name, 'extra-chart.png')
  assert.equal(turns[0].user_attachments[2].text_excerpt, '如果 B2 被击穿，则只看下方承接，不追多。')
})
