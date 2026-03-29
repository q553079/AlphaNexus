import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStoryIndexEntries,
  resolveEditableNoteBlocks,
} from '../../src/renderer/app/features/session-workbench/modules/session-note-blocks.ts'

test('session story index follows note order and prefers linked AI summaries', () => {
  const payload = {
    session: {
      id: 'session_1',
    },
    current_context: {
      trade_id: null,
    },
    events: [
      {
        id: 'event_note',
        event_type: 'observation',
        screenshot_id: 'shot_1',
        trade_id: null,
        ai_run_id: null,
      },
      {
        id: 'event_ai',
        event_type: 'ai_summary',
        screenshot_id: 'shot_1',
        trade_id: null,
        ai_run_id: 'airun_1',
        occurred_at: '2026-03-28T01:10:00.000Z',
      },
    ],
    analysis_cards: [
      {
        ai_run_id: 'airun_1',
        summary_short: 'AI 判断这里是第一次回踩确认。',
      },
    ],
    content_blocks: [
      {
        id: 'block_2',
        block_type: 'markdown',
        title: '第二段',
        content_md: '这里是普通笔记，没有 AI 摘要。',
        sort_order: 2,
        context_type: 'session',
        context_id: 'session_1',
        soft_deleted: false,
        event_id: null,
        created_at: '2026-03-28T01:20:00.000Z',
      },
      {
        id: 'block_1',
        block_type: 'markdown',
        title: '第一段',
        content_md: '这里会关联 AI 摘要。',
        sort_order: 1,
        context_type: 'session',
        context_id: 'session_1',
        soft_deleted: false,
        event_id: 'event_note',
        created_at: '2026-03-28T01:05:00.000Z',
      },
    ],
  }

  const { activeBlocks } = resolveEditableNoteBlocks(payload)
  const entries = buildStoryIndexEntries(payload, activeBlocks)

  assert.deepEqual(activeBlocks.map((block) => block.id), ['block_1', 'block_2'])
  assert.deepEqual(entries.map((entry) => entry.label), ['事件 1', '事件 2'])
  assert.equal(entries[0].summary, 'AI 判断这里是第一次回踩确认。')
  assert.match(entries[1].summary, /这里是普通笔记/)
})
