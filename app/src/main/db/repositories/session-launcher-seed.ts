import type Database from 'better-sqlite3'

type SeedContract = {
  id: string
  symbol: string
  name: string
  venue: string
  asset_class: 'future' | 'crypto'
  quote_currency: string
}

const referenceContracts: SeedContract[] = [
  {
    id: 'contract_nq',
    symbol: 'NQ',
    name: 'Nasdaq E-mini',
    venue: 'CME',
    asset_class: 'future',
    quote_currency: 'USD',
  },
  {
    id: 'contract_es',
    symbol: 'ES',
    name: 'S&P 500 E-mini',
    venue: 'CME',
    asset_class: 'future',
    quote_currency: 'USD',
  },
  {
    id: 'contract_btc_usdt',
    symbol: 'BTCUSDT',
    name: 'Bitcoin / Tether',
    venue: 'Crypto',
    asset_class: 'crypto',
    quote_currency: 'USDT',
  },
]

export const seedReferenceContracts = (db: Database.Database) => {
  const row = db.prepare('SELECT COUNT(*) AS count FROM contracts').get() as { count: number }
  if (row.count > 0) {
    return
  }

  const createdAt = new Date().toISOString()
  const insert = db.prepare(`
    INSERT INTO contracts (id, schema_version, created_at, symbol, name, venue, asset_class, quote_currency)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    for (const contract of referenceContracts) {
      insert.run(
        contract.id,
        createdAt,
        contract.symbol,
        contract.name,
        contract.venue,
        contract.asset_class,
        contract.quote_currency,
      )
    }
  })

  tx()
}
