import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AppEnvironment } from '@main/app-shell/env'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import { ensureTradeReviewDraft } from '@main/review/review-service'
import {
  createCapturedScreenshotArtifactsForContext,
  loadScreenshotById,
} from '@main/db/repositories/workbench-repository'
import type { AiProviderConfig, AiRunExecutionResult } from '@shared/ai/contracts'
import type { CurrentContext } from '@shared/contracts/current-context'
import {
  SavePendingSnipResultSchema,
  type PendingSnipAnnotationInput,
  type PendingSnipCapture,
  type SavePendingSnipResult,
} from '@shared/capture/contracts'

const analysisProviderPriority = ['custom-http', 'deepseek', 'openai', 'anthropic'] as const
const captureKindTitles = {
  chart: '截图',
  execution: '执行截图',
  exit: '离场截图',
} as const
const tradeSideLabels = {
  long: '做多',
  short: '做空',
} as const
const tradeStatusLabels = {
  planned: '计划中',
  open: '持仓中',
  closed: '已关闭',
} as const

const hasOwn = <T extends object>(value: T | undefined, key: keyof T) =>
  value != null && Object.prototype.hasOwnProperty.call(value, key)

const sortByProviderPriority = <T extends { provider: typeof analysisProviderPriority[number] }>(items: T[]) =>
  [...items].sort((left, right) =>
    analysisProviderPriority.indexOf(left.provider) - analysisProviderPriority.indexOf(right.provider))

export const toCaptureFileUrl = (filePath: string) => `file:///${filePath.replace(/\\/g, '/')}`

export const buildCaptureAssetPath = async(paths: LocalFirstPaths, sessionId: string, extension: string) => {
  const targetDirectory = path.join(paths.screenshotsDir, sessionId)
  const targetPath = path.join(
    targetDirectory,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}${extension}`,
  )

  await mkdir(targetDirectory, { recursive: true })
  return targetPath
}

const loadCaptureScope = async(paths: LocalFirstPaths, sessionId: string) => {
  const db = await getDatabase(paths)
  const row = db.prepare(`
    SELECT
      sessions.id AS session_id,
      sessions.title AS session_title,
      sessions.contract_id AS contract_id,
      sessions.period_id AS period_id,
      contracts.symbol AS contract_symbol
    FROM sessions
    INNER JOIN contracts ON contracts.id = sessions.contract_id
    WHERE sessions.id = ?
    LIMIT 1
  `).get(sessionId) as {
    session_id: string
    session_title: string
    contract_id: string
    period_id: string
    contract_symbol: string
  } | undefined

  if (!row) {
    throw new Error(`未找到 Session ${sessionId}。`)
  }

  return row
}

const loadCaptureTradeTargets = async(paths: LocalFirstPaths, sessionId: string) => {
  const db = await getDatabase(paths)
  const rows = db.prepare(`
    SELECT id, symbol, side, status, quantity, opened_at
    FROM trades
    WHERE session_id = ? AND deleted_at IS NULL
    ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, opened_at DESC, created_at DESC
  `).all(sessionId) as Array<{
    id: string
    symbol: string
    side: 'long' | 'short'
    status: 'planned' | 'open' | 'closed'
    quantity: number
    opened_at: string
  }>

  return rows.map((row) => ({
    trade_id: row.id,
    trade_status: row.status,
    label: `${row.symbol} ${tradeSideLabels[row.side]}`,
    subtitle: `${tradeStatusLabels[row.status]} · 数量 ${row.quantity} · 开始 ${row.opened_at}`,
  }))
}

export const buildPendingTargetMetadata = async(
  paths: LocalFirstPaths,
  currentContext: CurrentContext,
) => {
  const sessionScope = await loadCaptureScope(paths, currentContext.session_id)
  const tradeTargets = await loadCaptureTradeTargets(paths, currentContext.session_id)
  const currentTradeTarget = currentContext.trade_id
    ? tradeTargets.find((target) => target.trade_id === currentContext.trade_id) ?? null
    : null
  const openTradeTarget = tradeTargets.find((target) => target.trade_status === 'open') ?? null

  return {
    target_kind: currentTradeTarget ? 'trade' as const : 'session' as const,
    target_label: currentTradeTarget?.label ?? sessionScope.session_title,
    target_subtitle: currentTradeTarget?.subtitle ?? 'Session 级目标 · Realtime view',
    session_title: sessionScope.session_title,
    contract_symbol: sessionScope.contract_symbol,
    open_trade_id: openTradeTarget?.trade_id ?? null,
    open_trade_label: openTradeTarget?.label ?? null,
  }
}

const buildSnipCaption = (
  pendingCapture: PendingSnipCapture,
  kind: PendingSnipCapture['kind'],
) => `${captureKindTitles[kind]} · ${pendingCapture.display_label}`

export type CaptureImageAsset = {
  toPNG: () => Buffer
  getSize: () => {
    width: number
    height: number
  }
}

export type CaptureSaveDependencies = {
  listAiProviders: (paths: LocalFirstPaths, env: AppEnvironment) => Promise<AiProviderConfig[]>
  runAiAnalysis: (paths: LocalFirstPaths, env: AppEnvironment, rawInput: unknown) => Promise<AiRunExecutionResult>
}

export const defaultCaptureSaveDependencies: CaptureSaveDependencies = {
  listAiProviders: async(paths, env) => {
    const { listAiProviders } = await import('@main/ai/service')
    return listAiProviders(paths, env)
  },
  runAiAnalysis: async(paths, env, rawInput) => {
    const { runAiAnalysis } = await import('@main/ai/service')
    return runAiAnalysis(paths, env, rawInput)
  },
}

export type ResolvedSaveTarget = {
  session_id: string
  contract_id: string
  period_id: string
  trade_id: string | null
  source_view: PendingSnipCapture['source_view']
  kind: PendingSnipCapture['kind']
}

export const resolvePendingSaveTarget = async(
  paths: LocalFirstPaths,
  pendingCapture: PendingSnipCapture,
  input: {
    trade_id?: string | null
    target_context?: {
      session_id?: string | null
      trade_id?: string | null
      source_view?: PendingSnipCapture['source_view']
      kind?: PendingSnipCapture['kind']
    }
    kind?: PendingSnipCapture['kind']
  },
): Promise<ResolvedSaveTarget> => {
  const requestedSessionId = input.target_context?.session_id ?? pendingCapture.session_id
  const sessionScope = await loadCaptureScope(paths, requestedSessionId)
  const tradeTargets = await loadCaptureTradeTargets(paths, requestedSessionId)
  const openTradeTarget = tradeTargets.find((target) => target.trade_status === 'open') ?? null
  const requestedTradeId = hasOwn(input, 'trade_id')
    ? input.trade_id ?? null
    : hasOwn(input.target_context, 'trade_id')
      ? input.target_context?.trade_id ?? null
      : requestedSessionId === pendingCapture.session_id
        ? pendingCapture.trade_id ?? null
        : null
  const kind = input.kind ?? input.target_context?.kind ?? pendingCapture.kind
  const effectiveTradeId = kind === 'exit'
    ? openTradeTarget?.trade_id ?? requestedTradeId
    : requestedTradeId

  if (effectiveTradeId && !tradeTargets.some((target) => target.trade_id === effectiveTradeId)) {
    throw new Error(`交易 ${effectiveTradeId} 不属于 Session ${requestedSessionId}。`)
  }

  return {
    session_id: requestedSessionId,
    contract_id: sessionScope.contract_id,
    period_id: sessionScope.period_id,
    trade_id: effectiveTradeId ?? null,
    source_view: input.target_context?.source_view ?? pendingCapture.source_view ?? 'capture-overlay',
    kind,
  }
}

export const persistSnipSelection = async(
  paths: LocalFirstPaths,
  pendingCapture: PendingSnipCapture,
  saveTarget: ResolvedSaveTarget,
  image: CaptureImageAsset,
  noteText?: string,
  annotations?: PendingSnipAnnotationInput[],
): Promise<SavePendingSnipResult> => {
  const targetPath = await buildCaptureAssetPath(paths, saveTarget.session_id, '.png')
  await writeFile(targetPath, image.toPNG())

  const db = await getDatabase(paths)
  const created = createCapturedScreenshotArtifactsForContext(db, {
    session_id: saveTarget.session_id,
    trade_id: saveTarget.trade_id,
    kind: saveTarget.kind,
    file_path: path.relative(paths.vaultDir, targetPath),
    asset_url: toCaptureFileUrl(targetPath),
    caption: buildSnipCaption(pendingCapture, saveTarget.kind),
    width: image.getSize().width,
    height: image.getSize().height,
    note_text: noteText,
    annotations: annotations?.map((annotation) => ({
      ...annotation,
      deleted_at: null,
    })),
  })

  if (saveTarget.kind === 'exit' && saveTarget.trade_id) {
    await ensureTradeReviewDraft(paths, saveTarget.trade_id)
  }

  const screenshot = loadScreenshotById(db, created.screenshot_id)
  return SavePendingSnipResultSchema.parse({
    screenshot,
    created_event_id: created.event_id,
    created_note_block_id: created.content_block_id,
    ai_run_id: null,
    ai_error: null,
  })
}

export const pickPreferredCaptureAnalysisProvider = async(
  paths: LocalFirstPaths,
  env: AppEnvironment,
  dependencies: CaptureSaveDependencies,
) => {
  const providers = await dependencies.listAiProviders(paths, env)
  const available = providers.filter((provider) => provider.enabled && provider.configured)
  return sortByProviderPriority(available)[0] ?? null
}
