import { useEffect, useMemo, useRef, useState } from 'react'
import { alphaNexusApi } from '@app/bootstrap/api'
import { translateCaptureKind } from '@app/ui/display-text'
import type { CaptureSelection, PendingSnipCapture } from '@shared/capture/contracts'

type RatioPoint = {
  x: number
  y: number
}

const isMac = navigator.platform.toLowerCase().includes('mac')
const modifierLabel = isMac ? 'Cmd' : 'Ctrl'

const clamp = (value: number) => Math.min(Math.max(value, 0), 1)

const toRatioPoint = (event: React.PointerEvent<HTMLDivElement>, element: HTMLDivElement | null): RatioPoint | null => {
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return null
  }

  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height),
  }
}

const normalizeSelection = (start: RatioPoint | null, end: RatioPoint | null): CaptureSelection | null => {
  if (!start || !end) {
    return null
  }

  const x1 = Math.min(start.x, end.x)
  const y1 = Math.min(start.y, end.y)
  const x2 = Math.max(start.x, end.x)
  const y2 = Math.max(start.y, end.y)

  if (x2 - x1 < 0.01 || y2 - y1 < 0.01) {
    return null
  }

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  }
}

export const CaptureOverlayPage = () => {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [pending, setPending] = useState<PendingSnipCapture | null>(null)
  const [anchor, setAnchor] = useState<RatioPoint | null>(null)
  const [cursor, setCursor] = useState<RatioPoint | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void alphaNexusApi.capture.getPendingSnip()
      .then((result) => {
        setPending(result)
        if (!result) {
          setMessage('当前没有待处理的截图框选任务。')
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? `加载失败：${error.message}` : '加载待处理截图任务失败。')
      })
  }, [])

  const selection = useMemo(() => normalizeSelection(anchor, cursor), [anchor, cursor])

  const selectionMetrics = useMemo(() => {
    if (!pending || !selection) {
      return null
    }

    return {
      width: Math.round(selection.width * pending.source_width),
      height: Math.round(selection.height * pending.source_height),
    }
  }, [pending, selection])

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

  const handleSendToNote = async() => {
    if (!selection) {
      setMessage('请先拖拽选区，再送入当前 Session。')
      return
    }

    try {
      setBusy(true)
      await alphaNexusApi.capture.savePendingSnip({ selection })
    } catch (error) {
      setMessage(error instanceof Error ? `保存失败：${error.message}` : '保存选区失败。')
      setBusy(false)
    }
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

      if (selection && (event.key === 'Enter' || (isModifierPressed && event.shiftKey && event.key === 'Enter'))) {
        event.preventDefault()
        void handleSendToNote()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selection, busy])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = toRatioPoint(event, surfaceRef.current)
    if (!point) {
      return
    }

    setAnchor(point)
    setCursor(point)
    setDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!anchor || !dragging) {
      return
    }

    const point = toRatioPoint(event, surfaceRef.current)
    if (!point) {
      return
    }

    setCursor(point)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!anchor) {
      return
    }

    const point = toRatioPoint(event, surfaceRef.current)
    if (point) {
      setCursor(point)
    }

    setDragging(false)
  }

  return (
    <section className="capture-overlay">
      <header className="capture-overlay__toolbar">
        <div>
          <p className="eyebrow">快捷截图</p>
          <h1>快速截图</h1>
          <p className="capture-overlay__summary">
            拖拽选择截图区域。保存后的截图会归一到稳定高度，方便在工作台里统一查看。
          </p>
        </div>
        <div className="capture-overlay__actions">
          <button className="button is-secondary" disabled={busy || !pending} onClick={() => void handleCopy()} type="button">
            复制 ({modifierLabel}+Shift+C)
          </button>
          <button className="button is-primary" disabled={busy || !pending} onClick={() => void handleSendToNote()} type="button">
            送入笔记 (Enter)
          </button>
          <button className="button is-ghost" disabled={busy} onClick={() => void handleCancel()} type="button">
            取消 (Esc)
          </button>
        </div>
      </header>

      {message ? <div className="status-inline capture-overlay__status">{message}</div> : null}

      <div className="capture-overlay__meta">
        <span className="status-pill">Session：{pending?.session_id ?? '待定'}</span>
        <span className="status-pill">类型：{translateCaptureKind(pending?.kind ?? 'chart')}</span>
        <span className="status-pill">启动快捷键：{modifierLabel}+Shift+4</span>
        <span className="status-pill">复制后不关闭截图界面</span>
        {selectionMetrics ? (
          <span className="status-pill">
            选区：{selectionMetrics.width} x {selectionMetrics.height}
          </span>
        ) : null}
      </div>

      <div
        className="capture-overlay__surface"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={surfaceRef}
        role="presentation"
      >
        {pending ? (
          <>
            <img
              alt="待处理截图"
              className="capture-overlay__image"
              draggable={false}
              src={pending.source_data_url}
            />
            <div className="capture-overlay__mask" />
            {selection ? (
              <div
                className="capture-overlay__selection"
                style={{
                  left: `${selection.x * 100}%`,
                  top: `${selection.y * 100}%`,
                  width: `${selection.width * 100}%`,
                  height: `${selection.height * 100}%`,
                }}
              >
                <div className="capture-overlay__selection-meta">
                  {selectionMetrics?.width} x {selectionMetrics?.height}
                </div>
              </div>
            ) : (
              <div className="capture-overlay__hint-card">
                <strong>拖拽一个区域开始截图</strong>
                <p>{modifierLabel}+Shift+C 会复制并保持界面打开，Enter 会送入当前笔记流程。</p>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state capture-overlay__empty">当前没有可用的待处理截图画面。</div>
        )}
      </div>
    </section>
  )
}
