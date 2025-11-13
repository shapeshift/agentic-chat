import { NETWORKS } from '@shapeshiftoss/types'
import z from 'zod'

import type { ParsedTransaction } from '../lib/transactionHistory'
import { transactionFilterParams } from '../lib/transactionHistory/schemas'
import type { WalletContext } from '../utils/walletContextSimple'

import { executeGetTransactionHistory } from './getTransactionHistory'

export const analyzeTransactionHistoryInput = z.object({
  address: z
    .string()
    .optional()
    .describe(
      'Wallet address to query. If not provided, uses connected wallet address. For EVM networks, provide checksummed address (0x...). For Solana, provide base58 address.'
    ),
  network: z
    .enum(NETWORKS)
    .optional()
    .describe('Network name (e.g., ethereum, arbitrum, solana). If not provided, fetches from all supported networks'),
  pageSize: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(50)
    .describe('Number of transactions to fetch per network (max 50)'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Maximum total transactions to analyze across all networks after sorting by timestamp. Use this to analyze specific subsets (e.g., limit=5 for last 5 transactions)'
    ),
  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe('Number of transactions to skip before applying limit. Use for targeting specific transaction ranges'),
  ...transactionFilterParams,
  aggregations: z
    .array(z.enum(['count', 'totalFees', 'countByType']))
    .optional()
    .describe(
      'Aggregations to compute: count (total transactions), totalFees (sum of fees), countByType (breakdown by type)'
    ),
})

export type AnalyzeTransactionHistoryInput = z.infer<typeof analyzeTransactionHistoryInput>

interface Aggregations {
  count?: number
  totalFees?: string
  countByType?: Record<string, number>
}

interface Metadata {
  transactionCount: number
  networksChecked: string[]
  mayBeIncomplete?: boolean
}

export interface AnalyzeTransactionHistoryOutput {
  aggregations: Aggregations
  metadata: Metadata
  errors?: Record<string, string>
}

function calculateAggregations(transactions: ParsedTransaction[], requestedAggregations?: string[]): Aggregations {
  const aggregations: Aggregations = {}

  if (!requestedAggregations || requestedAggregations.length === 0) {
    return aggregations
  }

  if (requestedAggregations.includes('count')) {
    aggregations.count = transactions.length
  }

  if (requestedAggregations.includes('totalFees')) {
    const totalFees = transactions.reduce((sum, tx) => {
      const fee = parseFloat(tx.fee)
      return sum + (isNaN(fee) ? 0 : fee)
    }, 0)
    aggregations.totalFees = totalFees.toString()
  }

  if (requestedAggregations.includes('countByType')) {
    aggregations.countByType = transactions.reduce(
      (counts, tx) => {
        counts[tx.type] = (counts[tx.type] || 0) + 1
        return counts
      },
      {} as Record<string, number>
    )
  }

  return aggregations
}

export async function executeAnalyzeTransactionHistory(
  input: AnalyzeTransactionHistoryInput,
  walletContext?: WalletContext
): Promise<AnalyzeTransactionHistoryOutput> {
  console.log('[analyzeTransactionHistory]:', input)

  const { aggregations: requestedAggregations, pageSize, address, limit, offset, ...getHistoryInput } = input

  const historyResult = await executeGetTransactionHistory(
    { ...getHistoryInput, pageSize, limit, offset, address },
    walletContext
  )

  const aggregations = calculateAggregations(historyResult.transactions, requestedAggregations)

  const transactionCount = historyResult.transactions.length
  const maxPossiblePerNetwork = pageSize ?? 50
  const mayBeIncomplete = transactionCount >= maxPossiblePerNetwork * historyResult.networksChecked.length

  console.log('[analyzeTransactionHistory] Computed aggregations:', aggregations)
  console.log(
    `[analyzeTransactionHistory] Analyzed ${transactionCount} transactions${mayBeIncomplete ? ' (may be incomplete)' : ''}`
  )

  return {
    aggregations,
    metadata: {
      transactionCount,
      networksChecked: historyResult.networksChecked,
      mayBeIncomplete: mayBeIncomplete ? true : undefined,
    },
    errors: historyResult.errors,
  }
}

export const analyzeTransactionHistoryTool = {
  description:
    'Analyze transaction history with filtering and aggregations. Use this for analytical questions (e.g., "how much did I spend on fees?", "how many swaps did I make?"). Returns ONLY computed aggregations and metadata - does NOT return transaction details. If you need to show specific transactions, use getTransactionHistory instead. Available aggregations: count (total transactions), totalFees (sum of all fees), countByType (breakdown by send/receive/swap/contract). Supports filtering by types, status, dateFrom/dateTo. Warns if analysis may be incomplete due to pagination limits.',
  inputSchema: analyzeTransactionHistoryInput,
  execute: executeAnalyzeTransactionHistory,
}
