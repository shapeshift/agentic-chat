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

    // If address is provided, use it for all networks; otherwise use walletContext
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

    transactions = paginate(transactions, input.offset, input.limit)

    const aggregations = input.aggregations
      ? executeAggregations(transactions, input.aggregations as AggregationConfig[])
      : undefined

    const shouldIncludeTransactions = input.includeTransactions || !input.aggregations

    const mayBeIncomplete = strategy.mode === 'limited' && fetchedCount >= MAX_LIMITED_FETCH_COUNT

    return {
      transactions: shouldIncludeTransactions ? transactions : undefined,
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

    // Provide helpful error messages for common issues
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

    // Re-throw other errors with original message
    throw error
  }
}

export const transactionHistoryTool = {
  description: `Query and analyze transaction history with powerful filtering, sorting, and aggregation capabilities.

**When to use:**
- Any transaction-related questions (e.g., "show my last swap", "how much did I spend on fees?")
- Use includeTransactions=true (DEFAULT) to display transactions as UI cards
- Use includeTransactions=false ONLY for pure aggregation queries without displaying individual transactions

**IMPORTANT - UI Rendering:**
- By default, includeTransactions=true and transactions will be automatically rendered as beautiful UI cards
- DO NOT print or describe individual transaction details in your response - the UI will show them
- ONLY answer specific questions that require interpretation (e.g., "which one had the highest fee?", "what was the total?")
- For display requests like "show me my last 3 swaps", just acknowledge briefly (e.g., "Here are your last 3 swaps") without listing details
- Set includeTransactions=false ONLY when doing pure aggregation analysis without showing individual transactions

**Filtering:**
- types: ["send", "receive", "swap", "contract"] - Filter by transaction type
- status: ["success", "failed"] - Filter by status
- dateFrom/dateTo: Unix timestamps - Date range (triggers exhaustive fetch of ALL transactions in range)
- networks: ["ethereum", "arbitrum", ...] - Specific networks or omit for all networks
- address: "0x..." - Query other wallets, or omit for connected wallet
- includeAssets: ["FOX", "ETH"] - Only show transactions involving these asset symbols (case-insensitive)
- excludeAssets: ["USDC"] - Exclude transactions involving these asset symbols (case-insensitive)
  - If both specified, includeAssets is applied first, then excludeAssets
  - Matches token transfers AND native assets (ETH, SOL, etc.)

**Sorting:**
- sortBy: {field: "timestamp" | "fee" | "value" | "blockHeight" | "tokenTransferCount" | "usdValueSent" | "usdValueReceived" | "usdFee", order: "asc" | "desc"}
- Examples: Sort by usdFee descending for "most expensive in USD", by usdValueSent for "largest swap in USD"

**Pagination:**
- limit: Max transactions to return (e.g., limit=1 for "last tx", limit=5 for "last 5 txs")
- offset: Skip transactions (e.g., offset=1 for "second last tx")

**Render Control:**
- renderTransactions: Controls which transactions to display as UI cards
  - true (default): Display all returned transactions as cards
  - false: Don't display any cards (text response only, useful for "how many" queries)
  - number: Display first N transactions as cards (e.g., 1 for "show me the last...", 5 for "top 5")
  - Use renderTransactions=false when user asks for counts/totals without wanting to see transaction details
  - Use renderTransactions=N when filtering/sorting many txs but only want to display a few

**Aggregations (set includeTransactions=false to only return aggregations):**
- count: Total transaction count
- sum: {type: "sum", field: "fee" | "value" | "usdValueSent" | "usdValueReceived" | "usdFee"}
- avg: {type: "avg", field: "fee" | "value" | "usdValueSent" | "usdValueReceived" | "usdFee"}
- min/max: {type: "min" | "max", field: "fee" | "value" | "timestamp" | "usdValueSent" | "usdValueReceived" | "usdFee"}
- groupBy: {type: "groupBy", field: "type" | "status"}
- groupByTime: {type: "groupByTime", unit: "hour" | "day" | "week" | "month"}
- groupByAsset: {type: "groupByAsset"} - Group by asset from tokenTransfers
- tokenFlows: {type: "tokenFlows", direction: "in" | "out" | "net"} - Calculate net token flows per asset
- Nested aggregations supported (e.g., sum fees per day)
- USD fields (usdValueSent, usdValueReceived, usdFee) are numbers; fee and value are strings
- USD values calculated using current exchange rates

**Performance:**
- WITH date range: Fetches ALL transactions in range (exhaustive)
- WITHOUT date range: Limits to recent ~200 transactions (limited mode)
- Results cached for 5 minutes - follow-up queries are instant

**Examples:**
- "Show my last swap" → {types: ["swap"], limit: 1, renderTransactions: 1}
- "How much in fees this month?" → {dateFrom: startOfMonth, aggregations: [{type: "sum", field: "usdFee"}], renderTransactions: false}
- "Most expensive swap in USD" → {types: ["swap"], sortBy: {field: "usdValueSent", order: "desc"}, limit: 1, renderTransactions: 1}
- "Last swap that didn't involve FOX" → {types: ["swap"], excludeAssets: ["FOX"], limit: 1, renderTransactions: 1}
- "Show my USDC transactions" → {includeAssets: ["USDC"], renderTransactions: true}
- "How many times did I swap ETH?" → {types: ["swap"], includeAssets: ["ETH"], aggregations: [{type: "count"}], renderTransactions: false}
- "Daily trading volume this week" → {types: ["swap"], dateFrom: startOfWeek, aggregations: [{type: "groupByTime", unit: "day", aggregations: [{type: "sum", field: "usdValueSent"}]}], renderTransactions: false}`,
  inputSchema: transactionHistorySchema,
  execute: executeTransactionHistory,
}
