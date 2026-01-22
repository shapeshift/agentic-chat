import type { Network } from '@shapeshiftoss/types'

import { executeAggregations } from '../lib/transactionHistory/aggregations'
import type { AggregationConfig } from '../lib/transactionHistory/aggregations/types'
import { MAX_LIMITED_FETCH_COUNT } from '../lib/transactionHistory/constants'
import {
  determineFetchStrategy,
  fetchTransactions,
  getEvmSolanaNetworksFromWallet,
} from '../lib/transactionHistory/fetcher'
import { filter } from '../lib/transactionHistory/query/filter'
import { paginate } from '../lib/transactionHistory/query/paginate'
import { sort } from '../lib/transactionHistory/query/sort'
import type { TransactionHistoryToolInput, TransactionHistoryToolOutput } from '../lib/transactionHistory/schemas'
import { transactionHistoryToolInput } from '../lib/transactionHistory/schemas'
import type { WalletContext } from '../utils/walletContextSimple'

export const transactionHistorySchema = transactionHistoryToolInput

export type TransactionHistoryInput = TransactionHistoryToolInput
export type { TransactionHistoryToolOutput }

export async function executeTransactionHistory(
  input: TransactionHistoryInput,
  walletContext?: WalletContext
): Promise<TransactionHistoryToolOutput> {
  try {
    const networks: Network[] = input.networks || getEvmSolanaNetworksFromWallet(walletContext)

    if (networks.length === 0) {
      throw new Error('No networks specified and no connected wallets found')
    }

    if (!input.address && !walletContext) {
      throw new Error('No address provided and no wallet context available')
    }

    const addressOrWallet = input.address || walletContext!

    const strategy = determineFetchStrategy({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    })

    const {
      transactions: allTransactions,
      networksChecked,
      errors,
      fetchedCount,
    } = await fetchTransactions(networks, addressOrWallet, strategy)

    let transactions = allTransactions

    transactions = filter(transactions, {
      types: input.types,
      status: input.status,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      includeAssets: input.includeAssets,
      excludeAssets: input.excludeAssets,
    })

    transactions = sort(transactions, input.sortBy)

    const totalCount = transactions.length

    // Compute aggregations on full filtered+sorted set BEFORE pagination
    const aggregations = input.aggregations
      ? executeAggregations(transactions, input.aggregations as AggregationConfig[])
      : undefined

    // Paginate only the returned transactions
    const paginatedTransactions = paginate(transactions, input.offset ?? 0, input.limit)

    // Respect explicit includeTransactions: false
    const shouldIncludeTransactions = input.includeTransactions ?? !input.aggregations

    const mayBeIncomplete = strategy.mode === 'limited' && fetchedCount >= MAX_LIMITED_FETCH_COUNT

    return {
      transactions: shouldIncludeTransactions ? paginatedTransactions : undefined,
      aggregations,
      metadata: {
        transactionCount: totalCount,
        networksChecked,
        fetchedCount,
        fetchStrategy: strategy.mode,
        mayBeIncomplete: mayBeIncomplete ? true : undefined,
      },
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('[transactionHistory] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      throw new Error(
        'Transaction history query timed out. This could be due to network issues or a complex query. For complex queries, try: 1) Narrowing the date range, 2) Querying a single network, or 3) Retrying in a moment if this was a temporary network issue.'
      )
    }

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      throw new Error(
        'Unable to fetch transaction data. The blockchain indexer service may be temporarily unavailable.'
      )
    }

    throw error
  }
}

export const transactionHistoryTool = {
  description: `Query transaction history with filters.

UI CARD DISPLAYS: transaction list with type, amount, status, and timestamps.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

**Parameter Guidance:**
- For "last transaction" or "most recent tx" queries: Use renderTransactions: 1
- For "recent transactions" or "last few" queries: Use renderTransactions: 3-5
- For "all transactions" or large date ranges: Leave renderTransactions unset or use a reasonable limit (10-20)
- This prevents UI crashes when rendering large transaction lists

Default: Respond with one brief, natural sentence like:
- "Here's your transaction history"
- "I found your recent transactions"
- "Here's what I found"

Only elaborate if the user asks about something not shown in the card.`,
  inputSchema: transactionHistorySchema,
  execute: executeTransactionHistory,
}
