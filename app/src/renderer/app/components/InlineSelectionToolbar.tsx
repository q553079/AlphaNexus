type InlineSelectionToolbarProps = {
  disabled?: boolean
  onAction: (action: 'bold' | 'quote' | 'bullet') => void
}

export const InlineSelectionToolbar = ({
  disabled,
  onAction,
}: InlineSelectionToolbarProps) => (
  <div className="inline-selection-toolbar" role="toolbar">
    <button className="button is-secondary" disabled={disabled} onClick={() => onAction('bold')} type="button">
      加粗
    </button>
    <button className="button is-secondary" disabled={disabled} onClick={() => onAction('quote')} type="button">
      引用
    </button>
    <button className="button is-secondary" disabled={disabled} onClick={() => onAction('bullet')} type="button">
      要点
    </button>
  </div>
)
