import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { clipboard, BrowserWindow, desktopCapturer, dialog, nativeImage, screen } from 'electron'
import type { NativeImage, OpenDialogOptions, Rectangle } from 'electron'
import type { LocalFirstPaths } from '@main/app-shell/paths'
import { createMainWindow, getMainWindow } from '@main/app-shell/create-main-window'
import { getDatabase } from '@main/db/connection'
import {
  createImportedScreenshot,
  loadScreenshotById,
  replaceScreenshotAnnotations,
} from '@main/db/repositories/workbench-repository'
import { resolveDefaultSessionId } from '@main/db/repositories/workbench-utils'
import {
  clearPendingSnipCapture,
  getActiveCaptureContext,
  getPendingSnipCapture,
  setActiveCaptureContext,
  setPendingSnipCapture,
} from '@main/capture/capture-overlay-state'
import { closeCaptureOverlayWindow, openCaptureOverlayWindow } from '@main/capture/capture-overlay-window'
import {
  CaptureCommandResultSchema,
  CaptureResultSchema,
  CaptureSessionContextInputSchema,
  ImportScreenshotInputSchema,
  OpenSnipCaptureInputSchema,
  PendingSnipCaptureSchema,
  SaveScreenshotAnnotationsInputSchema,
  SnipCaptureSelectionInputSchema,
  type CaptureResult,
} from '@shared/capture/contracts'

const CONSISTENT_CAPTURE_HEIGHT = 960

const toFileUrl = (filePath: string) => `file:///${filePath.replace(/\\/g, '/')}`

const ensureMainWindow = () => getMainWindow() ?? createMainWindow()

const focusMainWindow = () => {
  const mainWindow = ensureMainWindow()
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
  return mainWindow
}

const buildTargetPath = async(paths: LocalFirstPaths, sessionId: string, extension: string) => {
  const targetDirectory = path.join(paths.screenshotsDir, sessionId)
  const targetPath = path.join(
    targetDirectory,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}${extension}`,
  )

  await mkdir(targetDirectory, { recursive: true })
  return targetPath
}

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

const resolveCaptureSessionId = async(paths: LocalFirstPaths, requestedSessionId?: string) => {
  if (requestedSessionId) {
    return requestedSessionId
  }

  const activeContext = getActiveCaptureContext()
  if (activeContext.session_id) {
    return activeContext.session_id
  }

  const db = await getDatabase(paths)
  return resolveDefaultSessionId(db)
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
) => {
  const fullImage = nativeImage.createFromDataURL(pendingCapture.source_data_url)
  const rect = buildCropRect(selection, pendingCapture.source_width, pendingCapture.source_height)
  return normalizeCaptureHeight(fullImage.crop(rect))
}

const notifyCaptureSaved = (result: CaptureResult) => {
  const mainWindow = focusMainWindow()
  mainWindow.webContents.send('capture:saved', result)
}

const persistSnipSelection = async(
  paths: LocalFirstPaths,
  pendingCapture: NonNullable<ReturnType<typeof getPendingSnipCapture>>,
  image: NativeImage,
) => {
  const targetPath = await buildTargetPath(paths, pendingCapture.session_id, '.png')
  await writeFile(targetPath, image.toPNG())

  const db = await getDatabase(paths)
  const created = createImportedScreenshot(db, {
    session_id: pendingCapture.session_id,
    kind: pendingCapture.kind,
    file_path: path.relative(paths.vaultDir, targetPath),
    asset_url: toFileUrl(targetPath),
    caption: `截图 · ${pendingCapture.display_label}`,
    width: image.getSize().width,
    height: image.getSize().height,
  })

  const screenshot = loadScreenshotById(db, created.screenshot_id)
  return CaptureResultSchema.parse({
    screenshot,
    created_event_id: created.event_id,
  })
}

const getDisplayCaptureSource = async() => {
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
  setActiveCaptureContext(input)
  return CaptureCommandResultSchema.parse({ ok: true })
}

export const openSnipCapture = async(paths: LocalFirstPaths, rawInput?: unknown) => {
  const input = OpenSnipCaptureInputSchema.parse(rawInput)
  const sessionId = await resolveCaptureSessionId(paths, input?.session_id)
  const baseCapture = await getDisplayCaptureSource()

  setPendingSnipCapture(PendingSnipCaptureSchema.parse({
    ...baseCapture.pending,
    session_id: sessionId,
    kind: input?.kind ?? getActiveCaptureContext().kind,
  }))

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

  clipboard.writeImage(buildSnipImage(pendingCapture, input.selection))
  return CaptureCommandResultSchema.parse({ ok: true })
}

export const savePendingSnip = async(paths: LocalFirstPaths, rawInput: unknown): Promise<CaptureResult> => {
  const input = SnipCaptureSelectionInputSchema.parse(rawInput)
  const pendingCapture = getPendingSnipCapture()
  if (!pendingCapture) {
    throw new Error('当前没有待处理的截图任务。')
  }

  const image = buildSnipImage(pendingCapture, input.selection)
  const result = await persistSnipSelection(paths, pendingCapture, image)

  clearPendingSnipCapture()
  closeCaptureOverlayWindow()
  notifyCaptureSaved(result)
  return result
}

export const cancelPendingSnip = async() => {
  clearPendingSnipCapture()
  closeCaptureOverlayWindow()
  return CaptureCommandResultSchema.parse({ ok: true })
}

export const importScreenshotIntoSession = async(paths: LocalFirstPaths, rawInput: unknown): Promise<CaptureResult> => {
  const input = ImportScreenshotInputSchema.parse(rawInput)
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
  const targetPath = await buildTargetPath(paths, input.session_id, extension)

  await copyFile(sourcePath, targetPath)

  const image = nativeImage.createFromPath(targetPath)
  const { width, height } = image.getSize()
  const db = await getDatabase(paths)
  const created = createImportedScreenshot(db, {
    session_id: input.session_id,
    kind: input.kind,
    file_path: path.relative(paths.vaultDir, targetPath),
    asset_url: toFileUrl(targetPath),
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
