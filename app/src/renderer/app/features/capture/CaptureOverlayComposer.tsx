import { TargetSelector } from '@app/features/context/TargetSelector'
import { translateAnnotationShape, translateCaptureKind } from '@app/ui/display-text'
import type { PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import type { PendingSnipCapture } from '@shared/capture/contracts'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'

type CaptureOverlayComposerProps = {
  activeAnnotationIndex: number | null
  annotations: PendingDraftAnnotation[]
  busy: boolean
  modifierLabel: string
  noteText: string
  pending: PendingSnipCapture | null
  selectedTargetOption: CurrentTargetOption | null
  selectionMetrics: {
    width: number
    height: number
  } | null
  targetPayload: CurrentTargetOptionsPayload | null
  onActiveAnnotationIndexChange: (index: number | null) => void
  onAnnotationChange: (index: number, patch: Partial<PendingDraftAnnotation>) => void
  onCancel: () => void
  onClearAnnotations: () => void
  onCopy: () => void
  onDeleteActiveAnnotation: () => void
  onNoteChange: (value: string) => void
  onSave: () => void
  onSaveAndRunAi: () => void
  onSaveAsExit: () => void
  onTargetSelect: (option: CurrentTargetOption) => void
}

export const CaptureOverlayComposer = ({
  activeAnnotationIndex,
  annotations,
  busy,
  modifierLabel,
  noteText,
  pending,
  selectedTargetOption,
  selectionMetrics,
  targetPayload,
  onActiveAnnotationIndexChange,
  onAnnotationChange,
  onCancel,
  onClearAnnotations,
  onCopy,
  onDeleteActiveAnnotation,
  onNoteChange,
  onSave,
  onSaveAndRunAi,
  onSaveAsExit,
  onTargetSelect,
}: CaptureOverlayComposerProps) => {
  const activeAnnotation = activeAnnotationIndex != null
    ? annotations[activeAnnotationIndex] ?? null
    : null
  const exitHint = pending?.open_trade_label
    ? `保存为 Exit 会优先挂到当前 open trade：${pending.open_trade_label}。`
    : '当前没有 open trade 时，Exit 会保留在当前选中的目标上。'

  return (
    <aside className="capture-overlay-composer">
      <div className="capture-overlay-composer__section">
        <p className="capture-overlay-composer__eyebrow">Current Target</p>
        <div className="capture-overlay-composer__target-card">
          <strong>{selectedTargetOption?.label ?? pending?.target_label ?? '待定目标'}</strong>
          <p>{selectedTargetOption?.subtitle ?? pending?.target_subtitle ?? '当前没有可用 target。'}</p>
          <div className="capture-overlay-composer__target-meta">
            <span className="status-pill">{pending?.contract_symbol ?? '未绑定合约'}</span>
            <span className="status-pill">{selectedTargetOption?.session_title ?? pending?.session_title ?? '未绑定 Session'}</span>
            <span className="status-pill">{translateCaptureKind(pending?.kind ?? 'chart')}</span>
            {selectionMetrics ? (
              <span className="status-pill">
                {selectionMetrics.width} x {selectionMetrics.height}
              </span>
            ) : null}
          </div>
        </div>
        {targetPayload ? (
          <TargetSelector
            busy={busy}
            label="保存到"
            onSelect={onTargetSelect}
            selectedOptionId={selectedTargetOption?.id ?? null}
            targetPayload={targetPayload}
            triggerPlaceholder="选择保存目标"
            variant="panel"
          />
        ) : null}
      </div>

      <div className="capture-overlay-composer__section">
        <div className="capture-overlay-composer__section-head">
          <div>
            <p className="capture-overlay-composer__eyebrow">Annotation Layer</p>
            <strong className="capture-overlay-composer__section-title">内联标注</strong>
          </div>
          {annotations.length > 0 ? (
            <button className="button is-ghost" disabled={busy} onClick={onClearAnnotations} type="button">
              清空
            </button>
          ) : null}
        </div>

        {annotations.length > 0 ? (
          <>
            <div className="capture-overlay-composer__annotation-list">
              {annotations.map((annotation, index) => (
                <button
                  className={`capture-overlay-composer__annotation-chip ${index === activeAnnotationIndex ? 'is-active' : ''}`.trim()}
                  disabled={busy}
                  key={`${annotation.label}-${index}`}
                  onClick={() => onActiveAnnotationIndexChange(index)}
                  type="button"
                >
                  <strong>{annotation.label}</strong>
                  <span>{translateAnnotationShape(annotation.shape)}</span>
                </button>
              ))}
            </div>

            {activeAnnotation ? (
              <div className="capture-overlay-composer__annotation-editor">
                <label className="capture-overlay-composer__field" htmlFor="capture-overlay-annotation-label">
                  <span>标注编号</span>
                  <input
                    className="inline-input"
                    disabled={busy}
                    id="capture-overlay-annotation-label"
                    onChange={(event) => onAnnotationChange(activeAnnotationIndex ?? 0, { label: event.target.value })}
                    value={activeAnnotation.label}
                  />
                </label>

                {activeAnnotation.shape === 'text' ? (
                  <label className="capture-overlay-composer__field" htmlFor="capture-overlay-annotation-text">
                    <span>文本内容</span>
                    <textarea
                      className="capture-overlay-composer__annotation-textarea"
                      disabled={busy}
                      id="capture-overlay-annotation-text"
                      onChange={(event) => onAnnotationChange(activeAnnotationIndex ?? 0, { text: event.target.value })}
                      rows={3}
                      value={activeAnnotation.text ?? ''}
                    />
                  </label>
                ) : null}

                <div className="capture-overlay-composer__annotation-meta">
                  <span className="status-pill">{translateAnnotationShape(activeAnnotation.shape)}</span>
                  <span className="status-pill">x1 {Math.round(activeAnnotation.x1)} / y1 {Math.round(activeAnnotation.y1)}</span>
                </div>

                <button className="button is-secondary" disabled={busy} onClick={onDeleteActiveAnnotation} type="button">
                  删除当前标注
                </button>
              </div>
            ) : (
              <p className="capture-overlay-composer__hint">点选一个标注后，可以在这里改编号或文本内容。</p>
            )}
          </>
        ) : (
          <p className="capture-overlay-composer__hint">先在左侧框选，再用矩形、圆形、线段、箭头或文本工具补充盘面标注。</p>
        )}
      </div>

      <div className="capture-overlay-composer__section">
        <label className="capture-overlay-composer__label" htmlFor="capture-overlay-note">
          当时观点
        </label>
        <textarea
          className="capture-overlay-composer__textarea"
          disabled={busy || !pending}
          id="capture-overlay-note"
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="记录当下看到的结构、触发条件、风险提示或执行想法。这里会先本地持久化，再按需触发 AI。"
          rows={8}
          value={noteText}
        />
        <p className="capture-overlay-composer__hint">{exitHint}</p>
      </div>

      <div className="capture-overlay-composer__section">
        <div className="capture-overlay-composer__actions">
          <button className="button is-primary" disabled={busy || !pending} onClick={onSave} type="button">
            保存
          </button>
          <button className="button is-secondary" disabled={busy || !pending} onClick={onSaveAndRunAi} type="button">
            保存并发 AI
          </button>
          <button className="button is-secondary" disabled={busy || !pending} onClick={onSaveAsExit} type="button">
            保存为 Exit
          </button>
          <button className="button is-secondary" disabled={busy || !pending} onClick={onCopy} type="button">
            复制
          </button>
          <button className="button is-ghost" disabled={busy} onClick={onCancel} type="button">
            取消
          </button>
        </div>

        <div className="capture-overlay-composer__shortcuts">
          <span>{modifierLabel}+Enter 保存</span>
          <span>{modifierLabel}+Shift+Enter 保存并发 AI</span>
          <span>{modifierLabel}+Shift+C 复制</span>
          <span>Esc 取消</span>
        </div>
      </div>
    </aside>
  )
}
