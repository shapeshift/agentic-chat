import { NETWORKS, TRANSACTION_STATUSES, TRANSACTION_TYPES } from '@shapeshiftoss/types'
import z from 'zod'

import { DIMENSIONS, DIRECTIONS, METRICS, SUMMABLE_METRICS, TIME_UNITS } from './aggregations/fieldTypes'
import { SORT_FIELDS, SORT_ORDERS } from './query/sort'

export const evmTokenTransferSchema = z.object({
  contract: z.string(),
  decimals: z
    .number()
    .nullable()
    .optional()
    .transform(val => val ?? undefined),
  name: z.string(),
  symbol: z.string(),
  type: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
})

export const solanaTokenTransferSchema = z.object({
  fromUserAccount: z.string().optional(),
  toUserAccount: z.string().optional(),
  fromTokenAccount: z.string().optional(),
  toTokenAccount: z.string().optional(),
  amount: z.number().optional(),
  mint: z.string().optional(),
  token: z
    .object({
      symbol: z.string(),
      name: z.string(),
      decimals: z.number(),
    })
    .optional(),
})

export const solanaNativeTransferSchema = z.object({
  fromUserAccount: z.string(),
  toUserAccount: z.string(),
  amount: z.number(),
})

export const evmTxSchema = z.object({
  txid: z.string(),
  blockHash: z.string().optional(),
  blockHeight: z.number(),
  timestamp: z.number(),
  status: z.number(),
  from: z.string(),
  to: z.string(),
  confirmations: z.number(),
  value: z.string(),
  fee: z.string(),
  gasLimit: z.string().optional(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
  inputData: z.string().optional(),
  tokenTransfers: z.array(evmTokenTransferSchema).optional(),
  internalTxs: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        value: z.string(),
      })
    )
    .optional(),
})

export const solanaTxSchema = z.object({
  txid: z.string(),
  blockHeight: z.number(),
  timestamp: z.number(),
  fee: z.number(),
  feePayer: z.string(),
  transactionError: z.unknown().nullable(),
  tokenTransfers: z.array(solanaTokenTransferSchema).optional(),
  nativeTransfers: z.array(solanaNativeTransferSchema).optional(),
  description: z.string().optional(),
  type: z.string().optional(),
})

export const transactionFilterParams = {
  types: z.array(z.enum(TRANSACTION_TYPES)).optional().describe('Filter by transaction types (e.g., ["swap", "send"])'),
  status: z.array(z.enum(TRANSACTION_STATUSES)).optional().describe('Filter by transaction status'),
  dateFrom: z.number().optional().describe('Filter transactions from this Unix timestamp (inclusive)'),
  dateTo: z.number().optional().describe('Filter transactions until this Unix timestamp (inclusive)'),
}

export const parsedTransactionSchema = z.object({
  txid: z.string(),
  timestamp: z.number(),
  blockHeight: z.number(),
  status: z.enum(TRANSACTION_STATUSES),
  type: z.enum(TRANSACTION_TYPES),
  value: z.string(),
  fee: z.string(),
  from: z.string(),
  to: z.string(),
  network: z.string().optional(),
  usdValueSent: z.number().optional(),
  usdValueReceived: z.number().optional(),
  usdFee: z.number().optional(),
  tokenTransfers: z
    .array(
      z.object({
        symbol: z.string(),
        amount: z.string(),
        decimals: z.number(),
        from: z.string(),
        to: z.string(),
        contract: z.string().optional(),
        assetId: z.string(),
        icon: z.string().optional(),
      })
    )
    .optional(),
})

const aggregationBase = z.object({
  as: z.string().optional().describe('Custom name for this aggregation result'),
})

const countAggregation = aggregationBase.extend({
  type: z.literal('count'),
})

const sumAggregation = aggregationBase.extend({
  type: z.literal('sum'),
  field: z.enum(SUMMABLE_METRICS).describe('Metric field to sum'),
})

const avgAggregation = aggregationBase.extend({
  type: z.literal('avg'),
  field: z.enum(SUMMABLE_METRICS).describe('Metric field to average'),
})

const minAggregation = aggregationBase.extend({
  type: z.literal('min'),
  field: z.enum(METRICS).describe('Metric field to find minimum'),
})

const maxAggregation = aggregationBase.extend({
  type: z.literal('max'),
  field: z.enum(METRICS).describe('Metric field to find maximum'),
})

const tokenFlowsAggregation = aggregationBase.extend({
  type: z.literal('tokenFlows'),
  direction: z.enum(DIRECTIONS).optional().default('net').describe('Direction of token flows to calculate'),
})

// Base aggregations without nesting (level 2)
const baseAggregationSchema = z.discriminatedUnion('type', [
  countAggregation,
  sumAggregation,
  avgAggregation,
  minAggregation,
  maxAggregation,
  tokenFlowsAggregation,
])

// Grouping aggregations with one level of nesting (level 1)
const groupByAggregation = aggregationBase.extend({
  type: z.literal('groupBy'),
  field: z.enum(DIMENSIONS).describe('Dimension field to group by'),
  aggregations: z
    .array(baseAggregationSchema)
    .optional()
    .describe('Nested aggregations to compute for each group (max depth: 1 level)'),
})

const groupByTimeAggregation = aggregationBase.extend({
  type: z.literal('groupByTime'),
  unit: z.enum(TIME_UNITS).describe('Time unit to group by'),
  aggregations: z
    .array(baseAggregationSchema)
    .optional()
    .describe('Nested aggregations to compute for each time period (max depth: 1 level)'),
})

const groupByAssetAggregation = aggregationBase.extend({
  type: z.literal('groupByAsset'),
  aggregations: z
    .array(baseAggregationSchema)
    .optional()
    .describe('Nested aggregations to compute for each asset (max depth: 1 level)'),
})

// Top-level aggregation schema (level 0) - includes all aggregations
const aggregationSchema = z.discriminatedUnion('type', [
  countAggregation,
  sumAggregation,
  avgAggregation,
  minAggregation,
  maxAggregation,
  groupByAggregation,
  groupByTimeAggregation,
  groupByAssetAggregation,
  tokenFlowsAggregation,
])

export const transactionHistoryToolInput = z.object({
  networks: z
    .array(z.enum(NETWORKS))
    .optional()
    .describe(
      'Networks to query. If omitted, queries all supported EVM and Solana networks. Examples: ["ethereum"], ["ethereum", "arbitrum", "base"]'
    ),

  address: z
    .string()
    .optional()
    .describe(
      'Wallet address to query. If not provided, uses connected wallet address. For EVM networks, provide checksummed address (0x...). For Solana, provide base58 address.'
    ),

  ...transactionFilterParams,

  includeAssets: z
    .array(z.string())
    .optional()
    .describe(
      'Only include transactions involving these asset symbols (case-insensitive). Examples: ["FOX", "ETH"], ["USDC", "USDT", "DAI"]. Matches against token transfer symbols and native assets.'
    ),

  excludeAssets: z
    .array(z.string())
    .optional()
    .describe(
      'Exclude transactions involving these asset symbols (case-insensitive). Examples: ["FOX"], ["USDC"]. If both includeAssets and excludeAssets are specified, includeAssets is applied first, then excludeAssets.'
    ),

  sortBy: z
    .object({
      field: z
        .enum(SORT_FIELDS)
        .default('timestamp')
        .describe(
          'Field to sort by. timestamp (default), fee, value, blockHeight, tokenTransferCount (number of token transfers), usdValueSent, usdValueReceived, or usdFee'
        ),
      order: z
        .enum(SORT_ORDERS)
        .default('desc')
        .describe('Sort order: asc (ascending - oldest/smallest first) or desc (descending - newest/largest first)'),
    })
    .optional()
    .describe('Sort configuration. Defaults to timestamp descending (newest first).'),

  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Maximum number of transactions to return after filtering and sorting. Useful for "show me top 5" queries.'
    ),

  offset: z
    .number()
    .min(0)
    .default(0)
    .describe(
      'Number of transactions to skip after filtering and sorting. Useful for pagination or "show me second most expensive swap".'
    ),

  aggregations: z
    .array(aggregationSchema)
    .optional()
    .describe('Aggregations to compute. If omitted, returns raw transactions only.'),

  includeTransactions: z
    .boolean()
    .default(true)
    .describe(
      'Include transaction details in response to render as UI cards. Defaults to true. Set to false only when doing pure aggregation queries without displaying transactions.'
    ),

  renderTransactions: z
    .union([z.boolean(), z.number().int().min(0)])
    .optional()
    .describe(
      'Controls which transactions to display as UI cards. IMPORTANT: Set this based on user intent - true/undefined: display all (use for "show all transactions"); false: display none (text-only analysis); number: display first N (use 1 for "last transaction", 3-5 for "recent transactions"). Prevents UI crashes by limiting rendered cards. Only applies when includeTransactions is true.'
    ),
})

export const transactionHistoryToolOutput = z.object({
  transactions: z.array(parsedTransactionSchema).optional(),
  aggregations: z.record(z.string(), z.union([z.number(), z.string(), z.record(z.string(), z.unknown())])).optional(),
  metadata: z.object({
    transactionCount: z.number().describe('Total transactions matching filters (before limit/offset)'),
    networksChecked: z.array(z.string()),
    fetchedCount: z.number().describe('Total fetched from APIs (before filtering)'),
    fetchStrategy: z.enum(['exhaustive', 'limited']),
    mayBeIncomplete: z.boolean().optional().describe('True if limited mode hit max transactions'),
  }),
  errors: z.record(z.string(), z.string()).optional(),
})

export type EvmTx = z.infer<typeof evmTxSchema>
export type SolanaTx = z.infer<typeof solanaTxSchema>
export type TransactionHistoryToolInput = z.infer<typeof transactionHistoryToolInput>
export type TransactionHistoryToolOutput = z.infer<typeof transactionHistoryToolOutput>
