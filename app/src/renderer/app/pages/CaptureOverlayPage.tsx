import { useEffect, useMemo, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import type { PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import { CaptureEditorSurface } from '@app/features/capture/CaptureEditorSurface'
import { CaptureOverlayComposer } from '@app/features/capture/CaptureOverlayComposer'
import type { CaptureSelection, PendingSnipCapture } from '@shared/capture/contracts'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'

const isMac = navigator.platform.toLowerCase().includes('mac')
const modifierLabel = isMac ? 'Cmd' : 'Ctrl'

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
  const [targetPayload, setTargetPayload] = useState<CurrentTargetOptionsPayload | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)
  const [selection, setSelection] = useState<CaptureSelection | null>(null)
  const [annotations, setAnnotations] = useState<PendingDraftAnnotation[]>([])
  const [activeAnnotationIndex, setActiveAnnotationIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncingTarget, setSyncingTarget] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    let cancelled = false

    void alphaNexusApi.capture.getPendingSnip()
      .then(async(result) => {
        if (cancelled) {
          return
        }

        setPending(result)
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

  const buildSaveInput = (
    input: {
      run_ai: boolean
      kind?: PendingSnipCapture['kind']
    },
  ) => {
    if (!selection || !pending) {
      return null
    }

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
      annotations: annotations.length > 0 ? annotations : undefined,
      note_text: noteText.trim() || undefined,
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
      const saveInput = buildSaveInput(input)
      if (!saveInput) {
        return
      }

      const result = await alphaNexusApi.capture.savePendingSnip(saveInput)
      if (result.ai_error) {
        setMessage(`已完成本地保存，AI 未完成：${result.ai_error}`)
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
      setMessage('当前截图 overlay 仅支持保存到 Session 或 Trade 目标。')
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
          <h1>Capture Overlay</h1>
          <p className="capture-overlay__summary">
            热键截图后，在同一层里完成框选、标注、观点输入和 target 选择。保存路径会先完成本地 screenshot、event、note、annotation 持久化，再按需触发 AI。
          </p>
        </div>
      </header>

      {message ? <div className="status-inline capture-overlay__status">{message}</div> : null}

      <div className="capture-overlay__meta">
        <span className="status-pill">Session：{selectedTargetOption?.session_title ?? pending?.session_title ?? pending?.session_id ?? '待定'}</span>
        <span className="status-pill">Target：{selectedTargetOption?.label ?? pending?.target_label ?? '待定'}</span>
        <span className="status-pill">启动快捷键：{modifierLabel}+Shift+4</span>
        <span className="status-pill">基础保存不依赖 AI</span>
        <span className="status-pill">复制后不关闭截图界面</span>
      </div>

      <div className="capture-overlay__workspace">
        <div className="capture-overlay__surface-card">
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
          annotations={annotations}
          busy={uiBusy}
          modifierLabel={modifierLabel}
          noteText={noteText}
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
          selectionMetrics={selectionMetrics}
          targetPayload={targetPayload}
        />
      </div>
    </section>
  )
}
