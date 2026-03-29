import { TargetSelector } from '@app/features/context/TargetSelector'
import {
  translateAnnotationSemantic,
  translateAnnotationShape,
  translateCaptureKind,
  translateScreenshotBackgroundLayer,
} from '@app/ui/display-text'
import type { PendingDraftAnnotation } from '@app/features/annotation/annotation-types'
import type { PendingSnipCapture } from '@shared/capture/contracts'
import type { ScreenshotAnalysisRole, ScreenshotBackgroundLayer } from '@shared/contracts/content'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'

const annotationSemanticOptions: Array<NonNullable<PendingDraftAnnotation['semantic_type']>> = [
  'support',
  'resistance',
  'liquidity',
  'fvg',
  'imbalance',
  'entry',
  'invalidation',
  'target',
  'path',
  'context',
]

const screenshotRoleOptions: Array<{ value: ScreenshotAnalysisRole, label: string }> = [
  { value: 'event', label: '普通事件' },
  { value: 'background', label: '背景图' },
]

const backgroundLayerOptions: Array<{ value: ScreenshotBackgroundLayer, label: string }> = [
  { value: 'macro', label: '宏观' },
  { value: 'htf', label: '高周期' },
  { value: 'structure', label: '结构' },
  { value: 'execution', label: '执行' },
  { value: 'custom', label: '自定义' },
]

type CaptureBackgroundOption = {
  id: string
  label: string
  subtitle: string
  layer: string
}

type CaptureContractOption = {
  id: string | null
  symbol: string
  subtitle: string
}

type CaptureOverlayComposerProps = {
  activeAnnotationIndex: number | null
  analysisRole: ScreenshotAnalysisRole
  analysisContractInput: string
  analysisContractOptions: CaptureContractOption[]
  analysisSessionBusy: boolean
  analysisSessionId: string | null
  analysisSessionOptions: CurrentTargetOption[]
  backgroundLabel: string
  backgroundLayer: ScreenshotBackgroundLayer
  backgroundNote: string
  backgroundOptions: CaptureBackgroundOption[]
  annotations: PendingDraftAnnotation[]
  busy: boolean
  modifierLabel: string
  noteText: string
  pending: PendingSnipCapture | null
  selectedTargetOption: CurrentTargetOption | null
  selectedBackgroundIds: string[]
  selectionMetrics: {
    width: number
    height: number
  } | null
  targetPayload: CurrentTargetOptionsPayload | null
  onActiveAnnotationIndexChange: (index: number | null) => void
  onAnnotationChange: (index: number, patch: Partial<PendingDraftAnnotation>) => void
  onAnalysisRoleChange: (value: ScreenshotAnalysisRole) => void
  onAnalysisContractInputChange: (value: string) => void
  onAnalysisContractSuggestionSelect: (option: CaptureContractOption) => void
  onAnalysisSessionChange: (sessionId: string) => void
  onBackgroundLabelChange: (value: string) => void
  onBackgroundLayerChange: (value: ScreenshotBackgroundLayer) => void
  onBackgroundNoteChange: (value: string) => void
  onBackgroundToggle: (screenshotId: string) => void
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
  analysisRole,
  analysisContractInput,
  analysisContractOptions,
  analysisSessionBusy,
  analysisSessionId,
  analysisSessionOptions,
  backgroundLabel,
  backgroundLayer,
  backgroundNote,
  backgroundOptions,
  annotations,
  busy,
  modifierLabel,
  noteText,
  pending,
  selectedTargetOption,
  selectedBackgroundIds,
  selectionMetrics,
  targetPayload,
  onActiveAnnotationIndexChange,
  onAnnotationChange,
  onAnalysisRoleChange,
  onAnalysisContractInputChange,
  onAnalysisContractSuggestionSelect,
  onAnalysisSessionChange,
  onBackgroundLabelChange,
  onBackgroundLayerChange,
  onBackgroundNoteChange,
  onBackgroundToggle,
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
    ? `保存为离场图会优先挂到当前持仓交易：${pending.open_trade_label}。`
    : '当前没有持仓交易时，离场图会保留在当前选中的目标上。'

  return (
    <aside className="capture-overlay-composer">
      <div className="capture-overlay-composer__section">
        <p className="capture-overlay-composer__eyebrow">当前保存目标</p>
        <div className="capture-overlay-composer__target-card">
          <strong>{selectedTargetOption?.label ?? pending?.target_label ?? '待定目标'}</strong>
          <p>{selectedTargetOption?.subtitle ?? pending?.target_subtitle ?? '当前没有可用保存目标。'}</p>
          <div className="capture-overlay-composer__target-meta">
            <span className="status-pill">{pending?.contract_symbol ?? '未绑定合约'}</span>
            <span className="status-pill">{selectedTargetOption?.session_title ?? pending?.session_title ?? '未绑定工作过程'}</span>
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
            <p className="capture-overlay-composer__eyebrow">AI 分析上下文</p>
            <strong className="capture-overlay-composer__section-title">分析上下文</strong>
          </div>
        </div>

        <div className="capture-overlay-composer__target-card">
          <p className="capture-overlay-composer__hint">
            保存归属和 AI 分析上下文是分开的。这里选的是 AI 按哪条工作过程和哪些背景图来理解当前截图，不会改动截图或交易的事实挂载。
          </p>

          <label className="capture-overlay-composer__field" htmlFor="capture-overlay-analysis-session">
            <span>AI 主工作过程</span>
            <select
              className="inline-input"
              disabled={busy || analysisSessionBusy || analysisSessionOptions.length === 0}
              id="capture-overlay-analysis-session"
              onChange={(event) => onAnalysisSessionChange(event.target.value)}
              value={analysisSessionId ?? ''}
            >
              {analysisSessionOptions.map((option) => (
                <option key={option.session_id} value={option.session_id}>
                  {option.session_title ?? option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="capture-overlay-composer__field" htmlFor="capture-overlay-analysis-contract">
            <span>合约品种</span>
            <input
              autoCapitalize="characters"
              autoCorrect="off"
              className="inline-input"
              disabled={busy}
              id="capture-overlay-analysis-contract"
              onChange={(event) => onAnalysisContractInputChange(event.target.value)}
              placeholder="例如：GC / NQ / ES / BTCUSD，可自定义"
              spellCheck={false}
              value={analysisContractInput}
            />
          </label>

          {analysisContractOptions.length > 0 ? (
            <div className="capture-overlay-composer__field">
              <span>合约建议</span>
              <div className="capture-overlay-composer__annotation-list">
                {analysisContractOptions.map((option) => {
                  const isActive = option.symbol.trim().toUpperCase() === analysisContractInput.trim().toUpperCase()
                  return (
                    <button
                      className={`capture-overlay-composer__annotation-chip ${isActive ? 'is-active' : ''}`.trim()}
                      disabled={busy}
                      key={`${option.id ?? 'custom'}:${option.symbol}`}
                      onClick={() => onAnalysisContractSuggestionSelect(option)}
                      type="button"
                    >
                      <strong>{option.symbol}</strong>
                      <span>{option.subtitle}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <p className="capture-overlay-composer__hint">
            合约品种可以手动输入。只有命中本地已知合约时，AI 才会带入对应的知识检索、相似案例和锚点过滤；否则只把它当成这次分析的显式上下文，不会改动真实工作过程或交易事实。
          </p>

          <label className="capture-overlay-composer__field" htmlFor="capture-overlay-analysis-role">
            <span>当前截图用途</span>
            <select
              className="inline-input"
              disabled={busy || !pending}
              id="capture-overlay-analysis-role"
              onChange={(event) => onAnalysisRoleChange(event.target.value as ScreenshotAnalysisRole)}
              value={analysisRole}
            >
              {screenshotRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          {analysisRole === 'background' ? (
            <>
              <label className="capture-overlay-composer__field" htmlFor="capture-overlay-background-layer">
                <span>背景层级</span>
                <select
                  className="inline-input"
                  disabled={busy || !pending}
                  id="capture-overlay-background-layer"
                  onChange={(event) => onBackgroundLayerChange(event.target.value as ScreenshotBackgroundLayer)}
                  value={backgroundLayer}
                >
                  {backgroundLayerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="capture-overlay-composer__field" htmlFor="capture-overlay-background-label">
                <span>背景标签</span>
                <input
                  className="inline-input"
                  disabled={busy || !pending}
                  id="capture-overlay-background-label"
                  onChange={(event) => onBackgroundLabelChange(event.target.value)}
                  placeholder="例如：GC 日线大背景 / 4H 结构演化"
                  value={backgroundLabel}
                />
              </label>
            </>
          ) : null}

          <label className="capture-overlay-composer__field" htmlFor="capture-overlay-background-note">
            <span>背景说明</span>
            <textarea
              className="capture-overlay-composer__annotation-textarea"
              disabled={busy || !pending}
              id="capture-overlay-background-note"
              onChange={(event) => onBackgroundNoteChange(event.target.value)}
              placeholder="补充宏观背景、上级别结构、当前这个截图为什么要放进背景层，或这次分析要优先看的条件。"
              rows={4}
              value={backgroundNote}
            />
          </label>

          <div className="capture-overlay-composer__field">
            <span>附加背景图</span>
            {analysisSessionBusy ? (
              <p className="capture-overlay-composer__hint">正在加载该工作过程的背景图。</p>
            ) : backgroundOptions.length > 0 ? (
              <div className="capture-overlay-composer__annotation-list">
                {backgroundOptions.map((option) => (
                  <button
                    className={`capture-overlay-composer__annotation-chip ${selectedBackgroundIds.includes(option.id) ? 'is-active' : ''}`.trim()}
                    disabled={busy}
                    key={option.id}
                    onClick={() => onBackgroundToggle(option.id)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.subtitle}</span>
                    <span>{translateScreenshotBackgroundLayer(option.layer as ScreenshotBackgroundLayer)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="capture-overlay-composer__hint">
                当前 AI 主工作过程里还没有已标成背景图的截图。先把更长周期图保存成背景图，后续这里就能选它们做演化上下文。
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="capture-overlay-composer__section">
        <div className="capture-overlay-composer__section-head">
          <div>
            <p className="capture-overlay-composer__eyebrow">标注层</p>
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

                <label className="capture-overlay-composer__field" htmlFor="capture-overlay-annotation-title">
                  <span>标题</span>
                  <input
                    className="inline-input"
                    disabled={busy}
                    id="capture-overlay-annotation-title"
                    onChange={(event) => onAnnotationChange(activeAnnotationIndex ?? 0, { title: event.target.value })}
                    value={activeAnnotation.title}
                  />
                </label>

                <label className="capture-overlay-composer__field" htmlFor="capture-overlay-annotation-semantic">
                  <span>语义类型</span>
                  <select
                    className="inline-input"
                    disabled={busy}
                    id="capture-overlay-annotation-semantic"
                    onChange={(event) => onAnnotationChange(activeAnnotationIndex ?? 0, {
                      semantic_type: event.target.value ? event.target.value as PendingDraftAnnotation['semantic_type'] : null,
                    })}
                    value={activeAnnotation.semantic_type ?? ''}
                  >
                    <option value="">未指定</option>
                    {annotationSemanticOptions.map((option) => (
                      <option key={option} value={option}>{translateAnnotationSemantic(option)}</option>
                    ))}
                  </select>
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

                <label className="capture-overlay-composer__field" htmlFor="capture-overlay-annotation-note">
                  <span>备注</span>
                  <textarea
                    className="capture-overlay-composer__annotation-textarea"
                    disabled={busy}
                    id="capture-overlay-annotation-note"
                    onChange={(event) => onAnnotationChange(activeAnnotationIndex ?? 0, { note_md: event.target.value })}
                    rows={3}
                    value={activeAnnotation.note_md}
                  />
                </label>

                <label className="capture-overlay-composer__field capture-overlay-composer__checkbox" htmlFor="capture-overlay-annotation-memory">
                  <input
                    checked={activeAnnotation.add_to_memory}
                    disabled={busy}
                    id="capture-overlay-annotation-memory"
                    onChange={(event) => onAnnotationChange(activeAnnotationIndex ?? 0, { add_to_memory: event.target.checked })}
                    type="checkbox"
                  />
                  <span>加入记忆候选</span>
                </label>

                <div className="capture-overlay-composer__annotation-meta">
                  <span className="status-pill">{translateAnnotationShape(activeAnnotation.shape)}</span>
                  <span className="status-pill">{translateAnnotationSemantic(activeAnnotation.semantic_type)}</span>
                  <span className="status-pill">x1 {Math.round(activeAnnotation.x1)} / y1 {Math.round(activeAnnotation.y1)}</span>
                </div>

                <button className="button is-secondary" disabled={busy} onClick={onDeleteActiveAnnotation} type="button">
                  删除当前标注
                </button>
              </div>
            ) : (
              <p className="capture-overlay-composer__hint">点选一个标注后，可以在这里修改编号、语义或文本内容。</p>
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
            保存为离场图
          </button>
          <button className="button is-secondary" disabled={busy || !pending} onClick={onCopy} type="button">
            复制
          </button>
          <button className="button is-ghost" disabled={busy} onClick={onCancel} type="button">
            取消
          </button>
        </div>

        <div className="capture-overlay-composer__shortcuts">
          <span>{modifierLabel}+回车键 保存</span>
          <span>{modifierLabel}+上档键+回车键 保存并发 AI</span>
          <span>{modifierLabel}+上档键+C 复制</span>
          <span>退出键 取消</span>
        </div>
      </div>
    </aside>
  )
}
