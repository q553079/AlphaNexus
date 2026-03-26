import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import type { NativeImage, OpenDialogOptions, Rectangle } from 'electron'
import type { AppEnvironment } from '@main/app-shell/env'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { getDatabase } from '@main/db/connection'
import {
  createImportedScreenshotForContext,
  getCurrentContext,
  loadScreenshotById,
  replaceScreenshotAnnotations,
  upsertCurrentContext,
} from '@main/db/repositories/workbench-repository'
import {
  clearPendingSnipCapture,
  getActiveCaptureContext,
  getPendingSnipCapture,
  setActiveCaptureContext,
  setPendingSnipCapture,
} from '@main/capture/capture-overlay-state'
import {
  buildCaptureAssetPath,
  buildPendingTargetMetadata,
  defaultCaptureSaveDependencies as defaultCaptureSaveFlowDependencies,
  persistSnipSelection,
  pickPreferredCaptureAnalysisProvider,
  resolvePendingSaveTarget,
  toCaptureFileUrl,
  type CaptureImageAsset,
  type CaptureSaveDependencies as CaptureSaveFlowDependencies,
} from '@main/capture/capture-save-flow'
import {
  CaptureCommandResultSchema,
  CaptureResultSchema,
  CaptureSessionContextInputSchema,
  ImportScreenshotInputSchema,
  OpenSnipCaptureInputSchema,
  PendingSnipCaptureSchema,
  SavePendingSnipInputSchema,
  SavePendingSnipResultSchema,
  SaveScreenshotAnnotationsInputSchema,
  SnipCaptureSelectionInputSchema,
  type CaptureResult,
  type SavePendingSnipResult,
} from '@shared/capture/contracts'

const CONSISTENT_CAPTURE_HEIGHT = 960

const ensureMainWindow = async() => {
  const { createMainWindow, getMainWindow } = await import('@main/app-shell/create-main-window')
  return getMainWindow() ?? createMainWindow()
}

const focusMainWindow = async() => {
  const mainWindow = await ensureMainWindow()
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
  return mainWindow
}

const hasOwn = <T extends object>(value: T | undefined, key: keyof T) =>
  value != null && Object.prototype.hasOwnProperty.call(value, key)

const normalizeCaptureHeight = (image: NativeImage) => {
  const { width, height } = image.getSize()
  if (height <= 0) {
    throw new Error('截图高度无效。')
  }

  if (height === CONSISTENT_CAPTURE_HEIGHT) {
    return image
  }

  const nextWidth = Math.max(1, Math.round((width * CONSISTENT_CAPTURE_HEIGHT) / height))
  return image.resize({
    width: nextWidth,
    height: CONSISTENT_CAPTURE_HEIGHT,
    quality: 'best',
  })
}

const resolveCaptureContext = async(
  paths: LocalFirstPaths,
  requested?: {
    session_id?: string
    contract_id?: string
    period_id?: string
    trade_id?: string | null
    source_view?: 'launcher' | 'session-workbench' | 'trade-detail' | 'period-review' | 'capture-overlay'
    kind?: 'chart' | 'execution' | 'exit'
  },
) => {
  const activeContext = getActiveCaptureContext()
  const db = await getDatabase(paths)
  const persisted = getCurrentContext(db, {
    session_id: requested?.session_id ?? activeContext.session_id ?? undefined,
    source_view: requested?.source_view ?? activeContext.source_view ?? 'session-workbench',
  })
  const sameSessionAsPersisted = activeContext.session_id != null && activeContext.session_id === persisted.session_id
  const nextContext = upsertCurrentContext(db, {
    session_id: requested?.session_id ?? activeContext.session_id ?? persisted.session_id,
    trade_id: hasOwn(requested, 'trade_id')
      ? requested?.trade_id ?? null
      : sameSessionAsPersisted
        ? activeContext.trade_id
        : persisted.trade_id,
    source_view: requested?.source_view ?? activeContext.source_view ?? persisted.source_view,
    capture_kind: requested?.kind ?? activeContext.kind ?? persisted.capture_kind,
  })

  setActiveCaptureContext({
    contract_id: nextContext.contract_id,
    period_id: nextContext.period_id,
    session_id: nextContext.session_id,
    trade_id: nextContext.trade_id,
    source_view: nextContext.source_view,
    kind: nextContext.capture_kind,
  })

  return nextContext
}

const clampRatio = (value: number) => Math.min(Math.max(value, 0), 1)

const buildCropRect = (
  selection: { x: number, y: number, width: number, height: number },
  sourceWidth: number,
  sourceHeight: number,
): Rectangle => {
  const x = Math.floor(clampRatio(selection.x) * sourceWidth)
  const y = Math.floor(clampRatio(selection.y) * sourceHeight)
  const right = Math.ceil(clampRatio(selection.x + selection.width) * sourceWidth)
  const bottom = Math.ceil(clampRatio(selection.y + selection.height) * sourceHeight)

  return {
    x: Math.min(x, sourceWidth - 1),
    y: Math.min(y, sourceHeight - 1),
    width: Math.max(1, Math.min(right - x, sourceWidth - x)),
    height: Math.max(1, Math.min(bottom - y, sourceHeight - y)),
  }
}

const buildSnipImage = (
  pendingCapture: NonNullable<ReturnType<typeof getPendingSnipCapture>>,
  selection: { x: number, y: number, width: number, height: number },
) => import('electron').then(({ nativeImage }) => {
  const fullImage = nativeImage.createFromDataURL(pendingCapture.source_data_url)
  const rect = buildCropRect(selection, pendingCapture.source_width, pendingCapture.source_height)
  return normalizeCaptureHeight(fullImage.crop(rect))
})

const notifyCaptureSaved = async(result: CaptureResult) => {
  const mainWindow = await focusMainWindow()
  mainWindow.webContents.send('capture:saved', result)
}

type CaptureSaveDependencies = CaptureSaveFlowDependencies & {
  buildImage: (
    pendingCapture: NonNullable<ReturnType<typeof getPendingSnipCapture>>,
    selection: { x: number, y: number, width: number, height: number },
  ) => Promise<CaptureImageAsset>
  closeOverlayWindow: () => Promise<void>
  notifySaved: typeof notifyCaptureSaved
}

const defaultCaptureSaveDependencies: CaptureSaveDependencies = {
  ...defaultCaptureSaveFlowDependencies,
  buildImage: buildSnipImage,
  closeOverlayWindow: async() => {
    const { closeCaptureOverlayWindow } = await import('@main/capture/capture-overlay-window')
    closeCaptureOverlayWindow()
  },
  notifySaved: notifyCaptureSaved,
}

const getDisplayCaptureSource = async() => {
  const { desktopCapturer, screen } = await import('electron')
  const { getMainWindow } = await import('@main/app-shell/create-main-window')
  const mainWindow = getMainWindow()
  const display = mainWindow
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay()
  const thumbnailSize = {
    width: Math.max(1, Math.floor(display.bounds.width * display.scaleFactor)),
    height: Math.max(1, Math.floor(display.bounds.height * display.scaleFactor)),
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize,
    fetchWindowIcons: false,
  })

  const source = sources.find((item) => item.display_id === `${display.id}`) ?? sources[0]
  if (!source) {
    throw new Error('无法访问桌面截图源。')
  }

  if (source.thumbnail.isEmpty()) {
    throw new Error('桌面截图源返回了空图像。')
  }

  const thumbnail = source.thumbnail.resize(thumbnailSize)
  const { width, height } = thumbnail.getSize()

  if (!width || !height) {
    throw new Error('桌面截图源返回了空图像。')
  }

  return {
    bounds: display.bounds,
    pending: {
      display_label: display.label || `Display ${display.id}`,
      source_width: width,
      source_height: height,
      source_data_url: thumbnail.toDataURL(),
    },
  }
}

export const setCaptureSessionContext = async(rawInput: unknown) => {
  const input = CaptureSessionContextInputSchema.parse(rawInput)
  setActiveCaptureContext({
    contract_id: input.contract_id ?? null,
    period_id: input.period_id ?? null,
    session_id: input.session_id ?? null,
    trade_id: input.trade_id ?? null,
    source_view: input.source_view ?? 'session-workbench',
    kind: input.kind,
  })
  return CaptureCommandResultSchema.parse({ ok: true })
}

export const openSnipCapture = async(paths: LocalFirstPaths, rawInput?: unknown) => {
  const input = OpenSnipCaptureInputSchema.parse(rawInput)
  const currentContext = await resolveCaptureContext(paths, input ? {
    session_id: input.session_id,
    contract_id: input.contract_id,
    period_id: input.period_id,
    trade_id: input.trade_id,
    source_view: input.source_view ?? 'capture-overlay',
    kind: input.kind,
  } : {
    source_view: 'capture-overlay',
  })
  const baseCapture = await getDisplayCaptureSource()
  const targetMetadata = await buildPendingTargetMetadata(paths, currentContext)

  setPendingSnipCapture(PendingSnipCaptureSchema.parse({
    ...baseCapture.pending,
    session_id: currentContext.session_id,
    contract_id: currentContext.contract_id,
    period_id: currentContext.period_id,
    trade_id: currentContext.trade_id,
    source_view: currentContext.source_view,
    kind: currentContext.capture_kind,
    target_kind: targetMetadata.target_kind,
    target_label: targetMetadata.target_label,
    target_subtitle: targetMetadata.target_subtitle,
    session_title: targetMetadata.session_title,
    contract_symbol: targetMetadata.contract_symbol,
    open_trade_id: targetMetadata.open_trade_id,
    open_trade_label: targetMetadata.open_trade_label,
  }))

  const { openCaptureOverlayWindow } = await import('@main/capture/capture-overlay-window')
  openCaptureOverlayWindow(baseCapture.bounds)
  return CaptureCommandResultSchema.parse({ ok: true })
}

export const getPendingSnip = async() => getPendingSnipCapture()

export const copyPendingSnip = async(rawInput: unknown) => {
  const input = SnipCaptureSelectionInputSchema.parse(rawInput)
  const pendingCapture = getPendingSnipCapture()
  if (!pendingCapture) {
    throw new Error('当前没有待处理的截图任务。')
  }

  const { clipboard } = await import('electron')
  clipboard.writeImage(await buildSnipImage(pendingCapture, input.selection))
  return CaptureCommandResultSchema.parse({ ok: true })
}

export const savePendingSnip = async(
  paths: LocalFirstPaths,
  env: AppEnvironment,
  rawInput: unknown,
  dependencies: CaptureSaveDependencies = defaultCaptureSaveDependencies,
): Promise<SavePendingSnipResult> => {
  const input = SavePendingSnipInputSchema.parse(rawInput)
  const pendingCapture = getPendingSnipCapture()
  if (!pendingCapture) {
    throw new Error('当前没有待处理的截图任务。')
  }

  const image = await dependencies.buildImage(pendingCapture, input.selection)
  const saveTarget = await resolvePendingSaveTarget(paths, pendingCapture, input)
  let result = await persistSnipSelection(
    paths,
    pendingCapture,
    saveTarget,
    image,
    input.note_text,
    input.annotations,
  )

  clearPendingSnipCapture()
  await dependencies.closeOverlayWindow()

  if (input.run_ai) {
    try {
      const provider = await pickPreferredCaptureAnalysisProvider(paths, env, dependencies)
      if (!provider) {
        result = SavePendingSnipResultSchema.parse({
          ...result,
          ai_error: '当前没有已启用且已配置完成的 AI provider。',
        })
      } else {
        const aiResult = await dependencies.runAiAnalysis(paths, env, {
          session_id: saveTarget.session_id,
          screenshot_id: result.screenshot.id,
          provider: provider.provider,
          prompt_kind: 'market-analysis',
        })
        result = SavePendingSnipResultSchema.parse({
          ...result,
          ai_run_id: aiResult.ai_run.id,
          ai_error: null,
        })
      }
    } catch (error) {
      result = SavePendingSnipResultSchema.parse({
        ...result,
        ai_error: error instanceof Error ? error.message : '运行 AI 分析失败。',
      })
    }
  }

  await dependencies.notifySaved(result)
  return result
}

export const cancelPendingSnip = async() => {
  clearPendingSnipCapture()
  const { closeCaptureOverlayWindow } = await import('@main/capture/capture-overlay-window')
  closeCaptureOverlayWindow()
  return CaptureCommandResultSchema.parse({ ok: true })
}

export const importScreenshotIntoSession = async(paths: LocalFirstPaths, rawInput: unknown): Promise<CaptureResult> => {
  const input = ImportScreenshotInputSchema.parse(rawInput)
  const currentContext = await resolveCaptureContext(paths, {
    session_id: input.session_id,
    contract_id: input.contract_id,
    period_id: input.period_id,
    trade_id: hasOwn(input, 'trade_id') ? input.trade_id ?? null : undefined,
    source_view: input.source_view ?? 'session-workbench',
    kind: input.kind,
  })
  const { BrowserWindow, dialog, nativeImage } = await import('electron')
  const focusedWindow = BrowserWindow.getFocusedWindow()
  const dialogOptions: OpenDialogOptions = {
    properties: ['openFile'],
    filters: [
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] },
    ],
  }
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions)

  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('已取消导入截图。')
  }

  const sourcePath = result.filePaths[0]
  const extension = path.extname(sourcePath)
  const targetPath = await buildCaptureAssetPath(paths, input.session_id, extension)

  await copyFile(sourcePath, targetPath)

  const image = nativeImage.createFromPath(targetPath)
  const { width, height } = image.getSize()
  const db = await getDatabase(paths)
  const created = createImportedScreenshotForContext(db, {
    session_id: currentContext.session_id,
    trade_id: currentContext.trade_id,
    kind: currentContext.capture_kind,
    file_path: path.relative(paths.vaultDir, targetPath),
    asset_url: toCaptureFileUrl(targetPath),
    caption: `导入图片 · ${path.basename(sourcePath)}`,
    width: width || 1600,
    height: height || 900,
  })

  const screenshot = loadScreenshotById(db, created.screenshot_id)
  return CaptureResultSchema.parse({
    screenshot,
    created_event_id: created.event_id,
  })
}

export const saveScreenshotAnnotations = async(paths: LocalFirstPaths, rawInput: unknown): Promise<CaptureResult> => {
  const input = SaveScreenshotAnnotationsInputSchema.parse(rawInput)
  const db = await getDatabase(paths)

  replaceScreenshotAnnotations(db, input.screenshot_id, input.annotations.map((annotation) => ({
    ...annotation,
    deleted_at: undefined,
  })))

  const screenshot = loadScreenshotById(db, input.screenshot_id)
  return CaptureResultSchema.parse({
    screenshot,
    created_event_id: screenshot.event_id,
  })
}
