import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPeriodReviewViewModel } from '../../src/renderer/app/features/review/period-review-view-model.ts'

test('period review view model keeps best/worst samples and mistake tags aligned with the rollup payload', () => {
  const payload = {
    sessions: [{ id: 'session-a' }],
    trade_metrics: [
      { trade_id: 'trade-best', tags: [{ id: 'mistake:system:chase', label: '追单', category: 'mistake', source: 'system' }] },
      { trade_id: 'trade-worst', tags: [{ id: 'mistake:system:early-exit', label: '提前离场', category: 'mistake', source: 'system' }] },
      { trade_id: 'trade-neutral', tags: [{ id: 'setup:user:opening-drive', label: 'opening-drive', category: 'setup', source: 'user' }] },
    ],
    period_rollup: {
      best_trade_ids: ['trade-best'],
      worst_trade_ids: ['trade-worst'],
      tag_summary: [
        { id: 'mistake:system:chase', label: '追单', category: 'mistake', source: 'system', count: 2, trade_ids: ['trade-best', 'trade-worst'] },
        { id: 'setup:user:opening-drive', label: 'opening-drive', category: 'setup', source: 'user', count: 1, trade_ids: ['trade-neutral'] },
      ],
    },
    highlight_cards: [{ id: 'card-a' }, { id: 'card-b' }, { id: 'card-c' }, { id: 'card-d' }],
    feedback_items: [],
    rule_rollup: [],
    setup_leaderboard: [],
    training_insights: [],
  }

  const viewModel = buildPeriodReviewViewModel(payload)

  assert.deepEqual(viewModel.bestTrades.map((trade) => trade.trade_id), ['trade-best'])
  assert.deepEqual(viewModel.worstTrades.map((trade) => trade.trade_id), ['trade-worst'])
  assert.deepEqual(viewModel.mistakeTags.map((tag) => tag.id), ['mistake:system:chase'])
  assert.deepEqual(viewModel.highlightCards.map((card) => card.id), ['card-a', 'card-b', 'card-c'])
  assert.equal(viewModel.hasMeaningfulData, true)
})
