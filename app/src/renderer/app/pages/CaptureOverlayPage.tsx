import { useEffect, useMemo, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import {
  renderAnnotatedImageDataUrl,
  serializeAnnotationDocument,
} from '@app/features/annotation/annotation-export'
import { CaptureEditorSurface } from '@app/features/capture/CaptureEditorSurface'
import { CaptureOverlayComposer } from '@app/features/capture/CaptureOverlayComposer'
import type { CaptureDisplay, CapturePreferences, CaptureSelection, PendingSnipCapture } from '@shared/capture/contracts'
import type { ScreenshotAnalysisRole, ScreenshotBackgroundLayer } from '@shared/contracts/content'
import type { ContractRecord } from '@shared/contracts/session'
import type { CurrentTargetOption, CurrentTargetOptionsPayload, SessionWorkbenchPayload } from '@shared/contracts/workbench'

const isMac = navigator.platform.toLowerCase().includes('mac')
const modifierLabel = isMac ? '命令键' : '控制键'

const formatShortcutLabel = (value: string) => value
  .replaceAll('CommandOrControl', '命令键/控制键')
  .replaceAll('Ctrl', '控制键')
  .replaceAll('Cmd', '命令键')
  .replaceAll('Shift', '上档键')
  .replaceAll('Enter', '回车键')
  .replaceAll('Esc', '退出键')

const normalizeContractSymbol = (value: string | null | undefined) => value?.trim().toUpperCase() ?? ''

const buildAnalysisSessionOptions = (payload: CurrentTargetOptionsPayload | null) => {
  if (!payload) {
    return []
  }

  const options = new Map<string, CurrentTargetOption>()
  for (const option of payload.options) {
    if (option.target_kind !== 'session') {
      continue
    }
    if (!options.has(option.session_id)) {
      options.set(option.session_id, option)
    }
  }

  return Array.from(options.values())
}

const buildBackgroundOptions = (
  payload: SessionWorkbenchPayload | null,
) => (payload?.screenshots ?? [])
  .filter((screenshot) => screenshot.analysis_role === 'background')
  .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
  .map((screenshot) => ({
    id: screenshot.id,
    label: screenshot.background_label ?? screenshot.caption ?? screenshot.id,
    subtitle: screenshot.caption ?? screenshot.created_at,
    layer: screenshot.background_layer ?? 'custom',
  }))

type CaptureContractOption = {
  id: string | null
  symbol: string
  subtitle: string
}

const buildAnalysisContractOptions = (
  contracts: ContractRecord[],
  analysisSessionPayload: SessionWorkbenchPayload | null,
  pending: PendingSnipCapture | null,
) => {
  const options = new Map<string, CaptureContractOption>()
  const pushOption = (input: CaptureContractOption) => {
    const key = normalizeContractSymbol(input.symbol)
    if (!key || options.has(key)) {
      return
    }
    options.set(key, input)
  }

  if (analysisSessionPayload) {
    pushOption({
      id: analysisSessionPayload.contract.id,
      symbol: analysisSessionPayload.contract.symbol,
      subtitle: `${analysisSessionPayload.contract.name} · AI 主工作过程`,
    })
  }

  for (const contract of contracts) {
    pushOption({
      id: contract.id,
      symbol: contract.symbol,
      subtitle: contract.name,
    })
  }

  if (pending?.contract_symbol) {
    pushOption({
      id: pending.contract_id ?? null,
      symbol: pending.contract_symbol,
      subtitle: '当前保存目标对应合约',
    })
  }

  return Array.from(options.values())
}

const resolveTargetOption = (
  payload: CurrentTargetOptionsPayload,
  pending: PendingSnipCapture,
  preferredOptionId?: string | null,
) => {
  if (preferredOptionId) {
    const matched = payload.options.find((option) => option.id === preferredOptionId)
    if (matched) {
      return matched
    }
  }

  const exactTarget = payload.options.find((option) =>
    option.session_id === pending.session_id
    && option.trade_id === (pending.trade_id ?? null))
  if (exactTarget) {
    return exactTarget
  }

  return payload.groups.current[0]
    ?? payload.options.find((option) => option.is_current)
    ?? payload.options[0]
    ?? null
}

export const CaptureOverlayPage = () => {
  const [pending, setPending] = useState<PendingSnipCapture | null>(null)
  const [displays, setDisplays] = useState<CaptureDisplay[]>([])
  const [preferences, setPreferences] = useState<CapturePreferences | null>(null)
  const [availableContracts, setAvailableContracts] = useState<ContractRecord[]>([])
  const [targetPayload, setTargetPayload] = useState<CurrentTargetOptionsPayload | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [selection, setSelection] = useState<CaptureSelection | null>(null)
  const [annotations, setAnnotations] = useState<PendingDraftAnnotation[]>([])
  const [activeAnnotationIndex, setActiveAnnotationIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncingTarget, setSyncingTarget] = useState(false)
  const [analysisSessionBusy, setAnalysisSessionBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [analysisSessionId, setAnalysisSessionId] = useState<string | null>(null)
  const [analysisSessionTouched, setAnalysisSessionTouched] = useState(false)
  const [analysisSessionPayload, setAnalysisSessionPayload] = useState<SessionWorkbenchPayload | null>(null)
  const [analysisContractInput, setAnalysisContractInput] = useState('')
  const [analysisContractTouched, setAnalysisContractTouched] = useState(false)
  const [selectedBackgroundIds, setSelectedBackgroundIds] = useState<string[]>([])
  const [analysisRole, setAnalysisRole] = useState<ScreenshotAnalysisRole>('event')
  const [backgroundLayer, setBackgroundLayer] = useState<ScreenshotBackgroundLayer>('macro')
  const [backgroundLabel, setBackgroundLabel] = useState('')
  const [backgroundNote, setBackgroundNote] = useState('')

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      alphaNexusApi.capture.getPendingSnip(),
      alphaNexusApi.capture.listDisplays(),
      alphaNexusApi.capture.getPreferences(),
      alphaNexusApi.launcher.getHome(),
    ])
      .then(async([result, nextDisplays, nextPreferences, homePayload]) => {
        if (cancelled) {
          return
        }

        setPending(result)
        setDisplays(nextDisplays)
        setPreferences(nextPreferences)
        setAvailableContracts(homePayload.contracts)
        setSelection(null)
        setAnnotations([])
        setActiveAnnotationIndex(null)

        if (!result) {
          setMessage('当前没有待处理的截图框选任务。')
          return
        }

        const payload = await alphaNexusApi.workbench.listTargetOptions({
          session_id: result.session_id,
          include_period_targets: false,
        })
        if (cancelled) {
          return
        }

        setTargetPayload(payload)
        const nextTarget = resolveTargetOption(payload, result)
        setSelectedTargetId(nextTarget?.id ?? null)
        const analysisSessionOptions = buildAnalysisSessionOptions(payload)
        const rememberedAnalysisSessionId = result.analysis_context_defaults.analysis_session_id
        const nextAnalysisSessionId = rememberedAnalysisSessionId
          && analysisSessionOptions.some((option) => option.session_id === rememberedAnalysisSessionId)
          ? rememberedAnalysisSessionId
          : nextTarget?.session_id ?? result.session_id
        setAnalysisSessionId(nextAnalysisSessionId)
        setAnalysisSessionTouched(false)
        setAnalysisRole(result.analysis_context_defaults.analysis_role)
        setBackgroundLayer(result.analysis_context_defaults.background_layer)
        setAnalysisContractInput(result.analysis_context_defaults.analysis_contract_symbol.trim())
        setAnalysisContractTouched(false)
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? `加载失败：${error.message}` : '加载待处理截图任务失败。')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectedTargetOption = useMemo(
    () => targetPayload?.options.find((option) => option.id === selectedTargetId)
      ?? (pending && targetPayload ? resolveTargetOption(targetPayload, pending, selectedTargetId) : null),
    [pending, selectedTargetId, targetPayload],
  )
  const analysisSessionOptions = useMemo(
    () => buildAnalysisSessionOptions(targetPayload),
    [targetPayload],
  )
  const backgroundOptions = useMemo(
    () => buildBackgroundOptions(analysisSessionPayload),
    [analysisSessionPayload],
  )
  const analysisContractOptions = useMemo(
    () => buildAnalysisContractOptions(availableContracts, analysisSessionPayload, pending),
    [analysisSessionPayload, availableContracts, pending],
  )
  const matchedAnalysisContract = useMemo(() => {
    const input = normalizeContractSymbol(analysisContractInput)
    if (!input) {
      return null
    }
    return analysisContractOptions.find((option) => normalizeContractSymbol(option.symbol) === input) ?? null
  }, [analysisContractInput, analysisContractOptions])

  const selectionMetrics = useMemo(() => {
    if (!pending || !selection) {
      return null
    }

    return {
      width: Math.round(selection.width * pending.source_width),
      height: Math.round(selection.height * pending.source_height),
    }
  }, [pending, selection])

  const uiBusy = busy || syncingTarget

  useEffect(() => {
    if (analysisSessionTouched) {
      return
    }

    const rememberedAnalysisSessionId = pending?.analysis_context_defaults.analysis_session_id ?? null
    const defaultSessionId = rememberedAnalysisSessionId
      && analysisSessionOptions.some((option) => option.session_id === rememberedAnalysisSessionId)
      ? rememberedAnalysisSessionId
      : selectedTargetOption?.session_id ?? pending?.session_id ?? null
    setAnalysisSessionId(defaultSessionId)
  }, [
    analysisSessionOptions,
    analysisSessionTouched,
    pending?.analysis_context_defaults.analysis_session_id,
    pending?.session_id,
    selectedTargetOption?.session_id,
  ])

  useEffect(() => {
    if (analysisContractTouched) {
      return
    }

    const rememberedContractId = pending?.analysis_context_defaults.analysis_contract_id ?? null
    const rememberedContractSymbol = pending?.analysis_context_defaults.analysis_contract_symbol?.trim() ?? ''
    const contractFromId = rememberedContractId
      ? analysisContractOptions.find((option) => option.id === rememberedContractId)?.symbol ?? ''
      : ''
    const nextContractInput = contractFromId
      || rememberedContractSymbol
      || analysisSessionPayload?.contract.symbol
      || pending?.contract_symbol
      || ''

    setAnalysisContractInput((current) => current === nextContractInput ? current : nextContractInput)
  }, [
    analysisContractOptions,
    analysisContractTouched,
    analysisSessionPayload?.contract.symbol,
    pending?.analysis_context_defaults.analysis_contract_id,
    pending?.analysis_context_defaults.analysis_contract_symbol,
    pending?.contract_symbol,
  ])

  useEffect(() => {
    if (!analysisSessionId) {
      setAnalysisSessionPayload(null)
      setSelectedBackgroundIds([])
      return
    }

    let cancelled = false
    setAnalysisSessionBusy(true)

    void alphaNexusApi.workbench.getSession({ session_id: analysisSessionId })
      .then((payload) => {
        if (cancelled) {
          return
        }

        setAnalysisSessionPayload(payload)
        setSelectedBackgroundIds((current) =>
          current.filter((screenshotId) => payload.screenshots.some((shot) => shot.id === screenshotId && shot.analysis_role === 'background')))
      })
      .catch((error) => {
        if (!cancelled) {
          setAnalysisSessionPayload(null)
          setSelectedBackgroundIds([])
          setMessage(error instanceof Error ? `加载 AI 上下文失败：${error.message}` : '加载 AI 上下文失败。')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAnalysisSessionBusy(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [analysisSessionId])

  const handleCancel = async() => {
    try {
      setBusy(true)
      await alphaNexusApi.capture.cancelPendingSnip()
      window.close()
    } catch (error) {
      setMessage(error instanceof Error ? `取消失败：${error.message}` : '取消截图任务失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async() => {
    if (!selection) {
      setMessage('请先拖拽选区，再执行复制。')
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.capture.copyPendingSnip({ selection })
      setMessage('已复制到剪贴板，截图界面保持打开。')
    } catch (error) {
      setMessage(error instanceof Error ? `复制失败：${error.message}` : '复制选区失败。')
    } finally {
      setBusy(false)
    }
  }

  const buildSaveInput = async(
    input: {
      run_ai: boolean
      kind?: PendingSnipCapture['kind']
    },
  ) => {
    if (!selection || !pending) {
      return null
    }

    const effectiveAnnotations = annotations.length > 0 ? annotations : []
    const annotated_image_data_url = await renderAnnotatedImageDataUrl({
      image_url: pending.source_data_url,
      source_width: pending.source_width,
      source_height: pending.source_height,
      selection,
      annotations: effectiveAnnotations,
    })
    const annotation_document_json = serializeAnnotationDocument({
      source_width: pending.source_width,
      source_height: pending.source_height,
      selection,
      annotations: effectiveAnnotations,
    })

    return {
      selection,
      target_context: {
        session_id: selectedTargetOption?.session_id ?? pending.session_id,
        contract_id: selectedTargetOption?.contract_id ?? pending.contract_id,
        period_id: selectedTargetOption?.period_id ?? pending.period_id,
        trade_id: selectedTargetOption?.trade_id ?? null,
        source_view: 'capture-overlay' as const,
        kind: pending.kind,
      },
      annotations: effectiveAnnotations.length > 0 ? effectiveAnnotations : undefined,
      note_text: noteText.trim() || undefined,
      annotated_image_data_url,
      annotation_document_json,
      screenshot_background: {
        analysis_role: analysisRole,
        analysis_session_id: analysisRole === 'background'
          ? (analysisSessionId ?? selectedTargetOption?.session_id ?? pending.session_id)
          : null,
        background_layer: analysisRole === 'background' ? backgroundLayer : null,
        background_label: analysisRole === 'background' ? (backgroundLabel.trim() || null) : null,
        background_note_md: analysisRole === 'background' ? backgroundNote.trim() : '',
      },
      analysis_context: {
        analysis_session_id: analysisSessionId ?? selectedTargetOption?.session_id ?? pending.session_id,
        analysis_contract_id: matchedAnalysisContract?.id ?? undefined,
        analysis_contract_symbol: analysisContractInput.trim() || undefined,
        background_screenshot_ids: selectedBackgroundIds,
        source_event_ids: [],
        image_region_mode: 'selection' as const,
        focus_annotation_ids: [],
        background_note_md: backgroundNote.trim() || undefined,
        attachments: [],
      },
      run_ai: input.run_ai,
      kind: input.kind,
    }
  }

  const handleSave = async(input: {
    run_ai: boolean
    kind?: PendingSnipCapture['kind']
  }) => {
    if (!selection) {
      setMessage('请先拖拽选区，再执行保存。')
      return
    }

    try {
      setBusy(true)
      const saveInput = await buildSaveInput(input)
      if (!saveInput) {
        return
      }

      const result = await alphaNexusApi.capture.savePendingSnip(saveInput)
      const resolutionNote = result.resolved_target?.resolution_note
      if (result.ai_error) {
        setMessage(`已完成本地保存，AI 未完成：${result.ai_error}${resolutionNote ? ` ${resolutionNote}` : ''}`)
      } else if (resolutionNote) {
        setMessage(resolutionNote)
      }
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存选区失败。')
    } finally {
      setBusy(false)
    }
  }

  const handleTargetSelect = async(option: CurrentTargetOption) => {
    if (!pending) {
      return
    }

    if (option.target_kind === 'period') {
      setMessage('当前截图浮层仅支持保存到工作过程或交易目标。')
      return
    }

    try {
      setSyncingTarget(true)
      const nextContext = await alphaNexusApi.workbench.setCurrentContext({
        session_id: option.session_id,
        contract_id: option.contract_id,
        period_id: option.period_id,
        trade_id: option.trade_id ?? null,
        source_view: 'capture-overlay',
        capture_kind: pending.kind,
      })
      const payload = await alphaNexusApi.workbench.listTargetOptions({
        session_id: option.session_id,
        include_period_targets: false,
      })
      const nextPendingTarget = resolveTargetOption(payload, {
        ...pending,
        session_id: nextContext.session_id,
        contract_id: nextContext.contract_id,
        period_id: nextContext.period_id,
        trade_id: nextContext.trade_id,
      }, option.id)

      setTargetPayload(payload)
      setSelectedTargetId(nextPendingTarget?.id ?? option.id)
      setPending({
        ...pending,
        session_id: nextContext.session_id,
        contract_id: nextContext.contract_id,
        period_id: nextContext.period_id,
        trade_id: nextContext.trade_id,
        target_kind: nextPendingTarget?.target_kind === 'trade' ? 'trade' : 'session',
        target_label: nextPendingTarget?.label ?? option.label,
        target_subtitle: nextPendingTarget?.subtitle ?? option.subtitle,
        session_title: nextPendingTarget?.session_title ?? pending.session_title,
      })
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? `切换目标失败：${error.message}` : '切换当前目标失败。')
    } finally {
      setSyncingTarget(false)
    }
  }

  const handleAnnotationChange = (index: number, patch: Partial<PendingDraftAnnotation>) => {
    setAnnotations((current) => current.map((annotation, currentIndex) =>
      currentIndex === index ? { ...annotation, ...patch } : annotation))
  }

  const handleDeleteActiveAnnotation = () => {
    if (activeAnnotationIndex == null) {
      return
    }

    setAnnotations((current) => current.filter((_, index) => index !== activeAnnotationIndex))
    setActiveAnnotationIndex(null)
  }

  const handleClearAnnotations = () => {
    setAnnotations([])
    setActiveAnnotationIndex(null)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void handleCancel()
        return
      }

      const isModifierPressed = isMac ? event.metaKey : event.ctrlKey

      if (selection && isModifierPressed && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void handleCopy()
        return
      }

      if (selection && isModifierPressed && event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        void handleSave({ run_ai: true })
        return
      }

      if (selection && isModifierPressed && event.key === 'Enter') {
        event.preventDefault()
        void handleSave({ run_ai: false })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selection, noteText, selectedTargetId, annotations, pending])

  return (
    <section className="capture-overlay">
      <header className="capture-overlay__toolbar">
        <div>
          <p className="eyebrow">快捷截图</p>
          <h1>截图浮层</h1>
          <p className="capture-overlay__summary">
            热键截图后，在同一层里完成框选、标注、观点输入和目标选择。保存路径会先完成本地截图、事件、笔记和标注持久化，再按需触发 AI。
          </p>
        </div>
      </header>

      {message ? <div className="status-inline capture-overlay__status">{message}</div> : null}

      <div className="capture-overlay__meta">
        <span className="status-pill">工作过程：{selectedTargetOption?.session_title ?? pending?.session_title ?? pending?.session_id ?? '待定'}</span>
        <span className="status-pill">保存目标：{selectedTargetOption?.label ?? pending?.target_label ?? '待定'}</span>
        <span className="status-pill">AI 主工作过程：{analysisSessionPayload?.session.title ?? analysisSessionOptions.find((option) => option.session_id === analysisSessionId)?.session_title ?? analysisSessionId ?? '待定'}</span>
        <span className="status-pill">屏幕：{pending?.display_label ?? '待定'}</span>
        <span className="status-pill">启动快捷键：{formatShortcutLabel(preferences?.snip_accelerator ?? `${modifierLabel}+上档键+4`)}</span>
        <span className="status-pill">基础保存不依赖 AI</span>
        <span className="status-pill">复制后不关闭截图界面</span>
      </div>

      <div className="capture-overlay__workspace">
        <div className="capture-overlay__surface-card">
          {pending && displays.length > 1 ? (
            <label className="field">
              <span>切换屏幕</span>
              <select
                className="session-workbench__trade-select"
                disabled={uiBusy}
                onChange={(event) => {
                  void alphaNexusApi.capture.openSnipCapture({
                    session_id: pending.session_id,
                    contract_id: pending.contract_id,
                    period_id: pending.period_id,
                    trade_id: pending.trade_id ?? null,
                    display_id: event.target.value,
                    source_view: 'capture-overlay',
                    kind: pending.kind,
                  })
                }}
                value={pending.display_id}
              >
                {displays.map((display) => (
                  <option key={display.id} value={display.id}>
                    {display.label}{display.is_primary ? ' · 主屏幕' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {pending ? (
            <CaptureEditorSurface
              activeAnnotationIndex={activeAnnotationIndex}
              allowCrop
              annotations={annotations}
              disabled={uiBusy}
              imageAlt="待处理截图"
              imageUrl={pending.source_data_url}
              onActiveAnnotationIndexChange={setActiveAnnotationIndex}
              onAnnotationsChange={setAnnotations}
              onSelectionAnnotationsCleared={() => setMessage('重新框选后，已清空当前标注。')}
              onSelectionChange={setSelection}
              selection={selection}
              sourceHeight={pending.source_height}
              sourceWidth={pending.source_width}
            />
          ) : (
            <div className="empty-state capture-overlay__empty">当前没有可用的待处理截图画面。</div>
          )}
        </div>

        <CaptureOverlayComposer
          activeAnnotationIndex={activeAnnotationIndex}
          analysisRole={analysisRole}
          analysisContractInput={analysisContractInput}
          analysisContractOptions={analysisContractOptions}
          analysisSessionBusy={analysisSessionBusy}
          analysisSessionId={analysisSessionId}
          analysisSessionOptions={analysisSessionOptions}
          backgroundLabel={backgroundLabel}
          backgroundLayer={backgroundLayer}
          backgroundNote={backgroundNote}
          backgroundOptions={backgroundOptions}
          annotations={annotations}
          busy={uiBusy}
          modifierLabel={modifierLabel}
          noteText={noteText}
          onAnalysisRoleChange={setAnalysisRole}
          onAnalysisContractInputChange={(value) => {
            setAnalysisContractTouched(true)
            setAnalysisContractInput(value)
          }}
          onAnalysisContractSuggestionSelect={(option) => {
            setAnalysisContractTouched(true)
            setAnalysisContractInput(option.symbol)
          }}
          onAnalysisSessionChange={(sessionId) => {
            setAnalysisSessionTouched(true)
            setAnalysisSessionId(sessionId)
          }}
          onBackgroundLabelChange={setBackgroundLabel}
          onBackgroundLayerChange={setBackgroundLayer}
          onBackgroundNoteChange={setBackgroundNote}
          onBackgroundToggle={(screenshotId) => {
            setSelectedBackgroundIds((current) =>
              current.includes(screenshotId)
                ? current.filter((id) => id !== screenshotId)
                : current.length >= 8
                  ? current
                  : [...current, screenshotId])
          }}
          onActiveAnnotationIndexChange={setActiveAnnotationIndex}
          onAnnotationChange={handleAnnotationChange}
          onCancel={() => void handleCancel()}
          onClearAnnotations={handleClearAnnotations}
          onCopy={() => void handleCopy()}
          onDeleteActiveAnnotation={handleDeleteActiveAnnotation}
          onNoteChange={setNoteText}
          onSave={() => void handleSave({ run_ai: false })}
          onSaveAndRunAi={() => void handleSave({ run_ai: true })}
          onSaveAsExit={() => void handleSave({ run_ai: false, kind: 'exit' })}
          onTargetSelect={(option) => void handleTargetSelect(option)}
          pending={pending}
          selectedTargetOption={selectedTargetOption}
          selectedBackgroundIds={selectedBackgroundIds}
          selectionMetrics={selectionMetrics}
          targetPayload={targetPayload}
        />
      </div>
    </section>
  )
}
