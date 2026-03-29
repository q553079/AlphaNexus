import type Database from 'better-sqlite3'
import { AiRunSchema } from '@shared/contracts/analysis'
import { createId, currentIso } from '@main/db/repositories/workbench-utils'

export const createFailedAiRun = (
  db: Database.Database,
  input: {
    session_id: string
    provider: 'deepseek' | 'openai' | 'anthropic' | 'custom-http'
    model: string
    prompt_kind: 'market-analysis' | 'trade-review' | 'period-review'
    input_summary: string
    prompt_preview: string
    failure_reason: string
  },
) => {
  const aiRunId = createId('airun')
  const timestamp = currentIso()
  const rawResponseText = `ERROR: ${input.failure_reason}`
  const structuredResponseJson = JSON.stringify({ error: input.failure_reason })

  db.prepare(`
    INSERT INTO ai_runs (
      id, schema_version, created_at, session_id, event_id, provider, model, status,
      prompt_kind, input_summary, prompt_preview, raw_response_text, structured_response_json, finished_at, deleted_at
    ) VALUES (?, 1, ?, ?, NULL, ?, ?, 'failed', ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    aiRunId,
    timestamp,
    input.session_id,
    input.provider,
    input.model,
    input.prompt_kind,
    input.input_summary,
    input.prompt_preview,
    rawResponseText,
    structuredResponseJson,
    timestamp,
  )

  return AiRunSchema.parse({
    id: aiRunId,
    schema_version: 1,
    created_at: timestamp,
    session_id: input.session_id,
    event_id: null,
    provider: input.provider,
    model: input.model,
    status: 'failed',
    prompt_kind: input.prompt_kind,
    input_summary: input.input_summary,
    prompt_preview: input.prompt_preview,
    raw_response_text: rawResponseText,
    structured_response_json: structuredResponseJson,
    finished_at: timestamp,
    deleted_at: null,
  })
}
