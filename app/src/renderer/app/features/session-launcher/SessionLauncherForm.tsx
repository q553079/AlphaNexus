import { useEffect, useState } from 'react'
import { translateMarketBias, translateSessionBucket } from '@app/ui/display-text'
import type { ContractRecord } from '@shared/contracts/session'
import type { CreateSessionInput } from '@shared/contracts/launcher'

type SessionLauncherFormProps = {
  busy?: boolean
  contracts: ContractRecord[]
  onSubmit: (input: CreateSessionInput) => void
}

const controlStyle = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.9)',
  color: 'var(--text)',
}

export const SessionLauncherForm = ({ busy, contracts, onSubmit }: SessionLauncherFormProps) => {
  const [contractId, setContractId] = useState('')
  const [bucket, setBucket] = useState<CreateSessionInput['bucket']>('am')
  const [title, setTitle] = useState('')
  const [marketBias, setMarketBias] = useState<CreateSessionInput['market_bias']>('neutral')
  const [contextFocus, setContextFocus] = useState('')
  const [tradePlanMd, setTradePlanMd] = useState('')
  const [tagsText, setTagsText] = useState('')

  useEffect(() => {
    if (!contractId && contracts[0]) {
      setContractId(contracts[0].id)
    }
  }, [contractId, contracts])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!contractId) {
      return
    }

    onSubmit({
      contract_id: contractId,
      bucket,
      title: title.trim() || undefined,
      market_bias: marketBias,
      context_focus: contextFocus.trim(),
      trade_plan_md: tradePlanMd.trim(),
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>合约</span>
          <select disabled={busy || contracts.length === 0} onChange={(event) => setContractId(event.target.value)} style={controlStyle} value={contractId}>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.symbol} · {contract.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>时段</span>
          <select disabled={busy} onChange={(event) => setBucket(event.target.value as CreateSessionInput['bucket'])} style={controlStyle} value={bucket}>
            <option value="am">{translateSessionBucket('am')}</option>
            <option value="pm">{translateSessionBucket('pm')}</option>
            <option value="night">{translateSessionBucket('night')}</option>
            <option value="custom">{translateSessionBucket('custom')}</option>
          </select>
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>标题</span>
          <input
            className="inline-input"
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="可选。留空时将自动生成 Session 标题。"
            value={title}
          />
        </label>

        <label className="field">
          <span>市场偏向</span>
          <select disabled={busy} onChange={(event) => setMarketBias(event.target.value as CreateSessionInput['market_bias'])} style={controlStyle} value={marketBias}>
            <option value="neutral">{translateMarketBias('neutral')}</option>
            <option value="bullish">{translateMarketBias('bullish')}</option>
            <option value="bearish">{translateMarketBias('bearish')}</option>
            <option value="range">{translateMarketBias('range')}</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>当前关注点</span>
        <textarea
          className="inline-input"
          disabled={busy}
          onChange={(event) => setContextFocus(event.target.value)}
          placeholder="这个 Session 里最重要的关注点是什么？"
          rows={3}
          value={contextFocus}
        />
      </label>

      <label className="field">
        <span>交易计划</span>
        <textarea
          className="inline-input"
          disabled={busy}
          onChange={(event) => setTradePlanMd(event.target.value)}
          placeholder="可选。填写这个 Session 的计划提纲。"
          rows={5}
          value={tradePlanMd}
        />
      </label>

      <label className="field">
        <span>标签</span>
        <input
          className="inline-input"
          disabled={busy}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="逗号分隔，例如 opening-drive, CPI, review"
          value={tagsText}
        />
      </label>

      <div className="action-row">
        <button className="button is-primary" disabled={busy || !contractId} type="submit">
          {busy ? '正在创建 Session...' : '创建 Session'}
        </button>
      </div>
    </form>
  )
}
