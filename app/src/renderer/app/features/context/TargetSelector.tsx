import { useDeferredValue, useMemo, useState } from 'react'
import type { CurrentTargetOption, CurrentTargetOptionsPayload } from '@shared/contracts/workbench'

type TargetSelectorData = Pick<CurrentTargetOptionsPayload, 'current_context' | 'options' | 'groups'>

type TargetSelectorProps = {
  busy: boolean
  emptyMessage?: string
  label?: string
  onSelect: (option: CurrentTargetOption) => void
  selectedOptionId?: string | null
  targetPayload: TargetSelectorData
  triggerPlaceholder?: string
  variant?: 'panel' | 'compact'
}

type TargetSection = {
  key: string
  title: string
  options: CurrentTargetOption[]
}

const kindLabels: Record<CurrentTargetOption['target_kind'], string> = {
  session: 'Session',
  trade: 'Trade',
  period: 'Period',
}

const buildSearchText = (option: CurrentTargetOption) => [
  option.label,
  option.subtitle,
  option.search_text,
  option.previous_period_trade_index != null ? `上一周期 第${option.previous_period_trade_index}笔 trade` : '',
].filter(Boolean).join(' ').toLowerCase()

const buildSections = (
  targetPayload: TargetSelectorData,
  query: string,
): TargetSection[] => {
  if (query.length > 0) {
    const matched = targetPayload.options.filter((option) => buildSearchText(option).includes(query))
    return matched.length > 0 ? [{ key: 'search', title: '搜索结果', options: matched }] : []
  }

  const sections: TargetSection[] = [
    { key: 'current', title: '当前目标', options: targetPayload.groups.current },
    { key: 'recent', title: '最近目标', options: targetPayload.groups.recent },
    { key: 'history', title: '历史 Session / Trade', options: targetPayload.groups.history },
    { key: 'previous_period_trades', title: '上一周期 Trade 快捷定位', options: targetPayload.groups.previous_period_trades },
  ]

  return sections.filter((section) => section.options.length > 0)
}

export const TargetSelector = ({
  busy,
  emptyMessage = '当前没有可选目标。',
  label = 'Target',
  onSelect,
  selectedOptionId,
  targetPayload,
  triggerPlaceholder = '选择目标',
  variant = 'panel',
}: TargetSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const deferredSearchText = useDeferredValue(searchText.trim().toLowerCase())
  const selectedOption = targetPayload.options.find((option) => option.id === selectedOptionId)
    ?? targetPayload.groups.current[0]
    ?? targetPayload.options.find((option) => option.is_current)
    ?? targetPayload.options[0]
    ?? null
  const sections = useMemo(
    () => buildSections(targetPayload, deferredSearchText),
    [deferredSearchText, targetPayload],
  )

  return (
    <div className={`target-selector target-selector--${variant}`.trim()}>
      <div className="target-selector__label-row">
        <span className="target-selector__label">{label}</span>
      </div>
      <button
        className={`target-selector__trigger ${isOpen ? 'is-open' : ''}`.trim()}
        disabled={busy || targetPayload.options.length === 0}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="target-selector__trigger-copy">
          <strong>{selectedOption?.label ?? triggerPlaceholder}</strong>
          <span>{selectedOption?.subtitle ?? '点击切换 current target、历史 session / trade，或直接搜索。'}</span>
        </span>
        <span className="target-selector__trigger-meta">{selectedOption ? kindLabels[selectedOption.target_kind] : 'Open'}</span>
      </button>

      {isOpen ? (
        <div className="target-selector__panel">
          <label className="target-selector__search">
            <span>搜索</span>
            <input
              className="inline-input"
              disabled={busy}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索当前目标、历史 session / trade、上一周期第 N 笔 trade"
              type="search"
              value={searchText}
            />
          </label>

          {sections.length > 0 ? sections.map((section) => (
            <section className="target-selector__section" key={section.key}>
              <header className="target-selector__section-header">
                <h3>{section.title}</h3>
                <span>{section.options.length}</span>
              </header>
              <div className="target-selector__option-list">
                {section.options.map((option) => (
                  <button
                    className={[
                      'target-selector__option',
                      option.id === selectedOption?.id ? 'is-selected' : '',
                      option.is_current ? 'is-current' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={busy}
                    key={option.id}
                    onClick={() => {
                      onSelect(option)
                      setIsOpen(false)
                      setSearchText('')
                    }}
                    type="button"
                  >
                    <div className="target-selector__option-head">
                      <strong>{option.label}</strong>
                      <div className="target-selector__badges">
                        <span className="status-pill">{kindLabels[option.target_kind]}</span>
                        {option.is_current ? <span className="status-pill is-active">Current</span> : null}
                        {option.previous_period_trade_index != null ? (
                          <span className="status-pill">上一周期 #{option.previous_period_trade_index}</span>
                        ) : null}
                      </div>
                    </div>
                    <p>{option.subtitle}</p>
                  </button>
                ))}
              </div>
            </section>
          )) : (
            <div className="empty-state target-selector__empty">{emptyMessage}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
