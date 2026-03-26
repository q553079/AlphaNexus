import { z } from 'zod'
import { EntityIdSchema, IsoDateTimeSchema } from '@shared/contracts/base'
import { EventSchema } from '@shared/contracts/event'
import type { TradeRecord } from '@shared/contracts/trade'
import { TradeSchema, TradeSideSchema } from '@shared/contracts/trade'

const PositiveQuantitySchema = z.number().positive()
const TradePriceSchema = z.number().positive()

export const OpenTradeInputSchema = z.object({
  session_id: EntityIdSchema,
  side: TradeSideSchema,
  quantity: PositiveQuantitySchema,
  entry_price: TradePriceSchema,
  stop_loss: TradePriceSchema,
  take_profit: TradePriceSchema,
  thesis: z.string().min(1),
  opened_at: IsoDateTimeSchema.optional(),
})

export const AddToTradeInputSchema = z.object({
  trade_id: EntityIdSchema,
  quantity: PositiveQuantitySchema,
  price: TradePriceSchema,
  occurred_at: IsoDateTimeSchema.optional(),
})

export const ReduceTradeInputSchema = z.object({
  trade_id: EntityIdSchema,
  quantity: PositiveQuantitySchema,
  price: TradePriceSchema,
  occurred_at: IsoDateTimeSchema.optional(),
})

export const CloseTradeInputSchema = z.object({
  trade_id: EntityIdSchema,
  exit_price: TradePriceSchema,
  closed_at: IsoDateTimeSchema.optional(),
})

export const TradeMutationResultSchema = z.object({
  trade: TradeSchema,
  event: EventSchema,
})

export const selectLatestTrade = (trades: TradeRecord[]): TradeRecord | null =>
  trades.length > 0 ? trades[trades.length - 1] ?? null : null

export const selectCurrentTrade = (trades: TradeRecord[]): TradeRecord | null =>
  trades.find((trade) => trade.status === 'open') ?? selectLatestTrade(trades)

export type OpenTradeInput = z.infer<typeof OpenTradeInputSchema>
export type AddToTradeInput = z.infer<typeof AddToTradeInputSchema>
export type ReduceTradeInput = z.infer<typeof ReduceTradeInputSchema>
export type CloseTradeInput = z.infer<typeof CloseTradeInputSchema>
export type TradeMutationResult = z.infer<typeof TradeMutationResultSchema>
