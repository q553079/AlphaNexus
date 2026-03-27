import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {
  getSessionWorkbench,
  updateWorkbenchAnnotation,
} from '../../src/main/domain/workbench-service.ts'
import {
  generateAiAnnotationSuggestions,
  generateComposerAiSuggestions,
} from '../../src/main/domain/suggestion-service.ts'
import {
  ingestKnowledgeSource,
  reviewKnowledgeDraftCard,
} from '../../src/main/domain/knowledge-service.ts'
import { applySuggestionAction } from '../../src/main/domain/suggestion-action-service.ts'
import {
  insertContract,
  insertEvent,
  insertPeriod,
  insertScreenshot,
  insertSession,
  withTempDb,
} from './helpers.mjs'

const loadSuggestionAudits = async(paths) => {
  const content = await readFile(path.join(paths.dataDir, 'suggestion-audits.jsonl'), 'utf8')
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

const seedApprovedKnowledge = async(paths) => {
  const ingested = await ingestKnowledgeSource(paths, {
    source_type: 'article',
    title: 'Opening drive playbook',
    contract_scope: 'NQ',
    timeframe_scope: '5m',
    tags: ['opening-drive', 'support'],
    extraction_mode: 'heuristic',
    content_md: [
      'setup: 开盘重新站上 VWAP 后，第一次回踩不破才按延续处理。',
      '',
      'entry-rule: 买盘重新吸收时进场，不追第一根扩展 K。',
      '',
      'risk-rule: 单次风险不超过账户 1%。',
    ].join('\n'),
  })

  await reviewKnowledgeDraftCard(paths, {
    knowledge_card_id: ingested.draft_cards[0].id,
    action: 'edit-approve',
    reviewed_by: 'regression',
    review_note_md: 'publish for runtime',
    edit_payload: {
      card_type: 'setup',
      title: 'Opening drive reclaim',
      summary: '重新站上 VWAP 后，等第一次回踩不破。',
      content_md: '重新站上 VWAP 后，等待第一次回踩不破，再按延续处理。',
      trigger_conditions_md: '- 第一次回踩不破',
      invalidation_md: '跌回 VWAP 下方并反抽失败。',
      risk_rule_md: '单次风险不超过账户 1%。',
      contract_scope: ['NQ'],
      timeframe_scope: ['5m'],
      tags: ['opening-drive', 'support'],
    },
  })
}

test('AlphaNexus composer and annotation regression guards', async(t) => {
  await t.test('composer keep action records accepted suggestion snapshot', async() => {
    await withTempDb('composer-accept-audit', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_composer' })
      insertContract(db, nextIso, { id: 'contract_composer', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_composer',
        contract_id: 'contract_composer',
        period_id: 'period_composer',
        title: 'composer session',
        tags: ['opening-drive', 'support'],
      })
      insertEvent(db, nextIso, {
        id: 'event_composer',
        session_id: 'session_composer',
        event_type: 'observation',
        title: 'opening drive reclaim',
        summary: 'reclaim held and first pullback stayed bid',
      })

      await seedApprovedKnowledge(paths)

      const suggestions = await generateComposerAiSuggestions(paths, {
        session_id: 'session_composer',
        draft_text: '观点：重新站上 VWAP 后等待第一次回踩确认。',
        max_items: 4,
      })
      assert.equal(suggestions.suggestions.length > 0, true)

      const accepted = suggestions.suggestions[0]
      const result = await applySuggestionAction(paths, {
        suggestion_id: accepted.id,
        suggestion_kind: 'composer',
        action: 'keep',
      })

      assert.equal(result.status, 'kept')
      assert.equal(result.applied_effect, 'audit-only')

      const audits = await loadSuggestionAudits(paths)
      const actionAudit = audits.find((row) => row.id === result.audit_id)
      assert.equal(actionAudit.payload.suggestion_snapshot.id, accepted.id)
      assert.equal(actionAudit.payload.suggestion_snapshot.label, accepted.label)
      assert.equal(actionAudit.payload.suggestion_snapshot.source_kind, accepted.source_kind)
      assert.equal(typeof actionAudit.payload.source_audit_id, 'string')
    })
  })

  await t.test('annotation keep/discard preserves candidate audit and formal annotation semantics', async() => {
    await withTempDb('annotation-keep-discard', async({ paths, db, nextIso }) => {
      insertPeriod(db, nextIso, { id: 'period_annotation' })
      insertContract(db, nextIso, { id: 'contract_annotation', symbol: 'NQ' })
      insertSession(db, nextIso, {
        id: 'session_annotation',
        contract_id: 'contract_annotation',
        period_id: 'period_annotation',
        title: 'annotation session',
        tags: ['opening-drive', 'support'],
      })
      insertScreenshot(db, nextIso, {
        id: 'shot_annotation',
        session_id: 'session_annotation',
        event_id: 'event_annotation',
        caption: 'annotation screenshot',
      })
      insertEvent(db, nextIso, {
        id: 'event_annotation',
        session_id: 'session_annotation',
        event_type: 'screenshot',
        title: 'annotation screenshot',
        summary: 'local screenshot saved',
        screenshot_id: 'shot_annotation',
      })

      await seedApprovedKnowledge(paths)

      const generated = await generateAiAnnotationSuggestions(paths, {
        session_id: 'session_annotation',
        screenshot_id: 'shot_annotation',
        max_items: 2,
      })
      assert.equal(generated.suggestions.length, 2)

      const keepSuggestion = generated.suggestions[0]
      const discardSuggestion = generated.suggestions[1]
      const keepResult = await applySuggestionAction(paths, {
        suggestion_id: keepSuggestion.id,
        suggestion_kind: 'annotation',
        action: 'keep',
      })
      assert.equal(keepResult.applied_effect, 'created-annotation')
      assert.equal(keepResult.annotation_id !== null, true)

      const afterKeep = await getSessionWorkbench(paths, { session_id: 'session_annotation' })
      const keptAnnotation = afterKeep.screenshots
        .find((shot) => shot.id === 'shot_annotation')
        ?.annotations.find((annotation) => annotation.id === keepResult.annotation_id)
      assert.equal(keptAnnotation?.title, keepSuggestion.title)
      assert.equal(keptAnnotation?.semantic_type, keepSuggestion.semantic_type)
      assert.equal(keptAnnotation?.note_md, keepSuggestion.reason_summary)
      assert.equal(keptAnnotation?.add_to_memory, false)

      const updated = await updateWorkbenchAnnotation(paths, {
        annotation_id: keepResult.annotation_id,
        label: 'MEM-1',
        title: 'Manual support memory',
        semantic_type: 'support',
        text: 'first pullback support',
        note_md: 'promote to memory candidate',
        add_to_memory: true,
      })
      assert.equal(updated.add_to_memory, true)
      assert.equal(updated.title, 'Manual support memory')

      const beforeDiscard = await getSessionWorkbench(paths, { session_id: 'session_annotation' })
      const beforeDiscardCount = beforeDiscard.screenshots.find((shot) => shot.id === 'shot_annotation')?.annotations.length ?? 0
      const discardResult = await applySuggestionAction(paths, {
        suggestion_id: discardSuggestion.id,
        suggestion_kind: 'annotation',
        action: 'discard',
      })
      assert.equal(discardResult.applied_effect, 'audit-only')

      const afterDiscard = await getSessionWorkbench(paths, { session_id: 'session_annotation' })
      const afterDiscardCount = afterDiscard.screenshots.find((shot) => shot.id === 'shot_annotation')?.annotations.length ?? 0
      assert.equal(afterDiscardCount, beforeDiscardCount)

      const audits = await loadSuggestionAudits(paths)
      const discardAudit = audits.find((row) => row.id === discardResult.audit_id)
      assert.equal(discardAudit.payload.suggestion_snapshot.id, discardSuggestion.id)
      assert.equal(discardAudit.payload.status, 'discarded')
    })
  })
})
