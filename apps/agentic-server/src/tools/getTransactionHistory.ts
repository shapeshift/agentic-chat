import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { Network } from '@shapeshiftoss/types'
import { chainIdToNetwork, EVM_SOLANA_NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'
import type { z } from 'zod'

import {
  fetchEvmTransactionHistory,
  fetchSolanaTransactionHistory,
  getTransactionHistoryInput,
} from '../lib/transactionHistory'
import type { ParsedTransaction } from '../lib/transactionHistory'
import { getAddressForNetwork } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

export const getTransactionHistorySchema = getTransactionHistoryInput

export type GetTransactionHistoryInput = z.infer<typeof getTransactionHistorySchema>

export type GetTransactionHistoryOutput = {
  transactions: ParsedTransaction[]
  cursors?: Record<string, string>
  networksChecked: string[]
  errors?: Record<string, string>
}

function getEvmSolanaNetworksFromWallet(walletContext?: WalletContext): Network[] {
  if (!walletContext?.connectedWallets) {
    return []
  }

  const networks: Network[] = []
  for (const chainId of Object.keys(walletContext.connectedWallets)) {
    const network = chainIdToNetwork[chainId]
    if (network && EVM_SOLANA_NETWORKS.includes(network as (typeof EVM_SOLANA_NETWORKS)[number])) {
      networks.push(network)
    }
  }

  return networks
}

async function fetchTransactionHistory(
  chainNamespace: string,
  url: string,
  address: string,
  network: Network
): Promise<{ transactions: ParsedTransaction[]; cursor?: string }> {
  if (chainNamespace === CHAIN_NAMESPACE.Evm) {
    return fetchEvmTransactionHistory(url, address, network)
  }

  if (chainNamespace === CHAIN_NAMESPACE.Solana) {
    return fetchSolanaTransactionHistory(url, address, network)
  }

  throw new Error(`Transaction history not supported for chain namespace: ${chainNamespace}`)
}

async function fetchSingleNetworkHistory(
  network: Network,
  pageSize: number,
  cursor: string | undefined,
  walletContext?: WalletContext,
  explicitAddress?: string
): Promise<{ transactions: ParsedTransaction[]; cursor?: string; address: string; chainId: string }> {
  const chainId = networkToChainIdMap[network]
  const address = explicitAddress || getAddressForNetwork(walletContext, network)
  const { chainNamespace } = fromChainId(chainId)

  if (chainNamespace !== CHAIN_NAMESPACE.Evm && chainNamespace !== CHAIN_NAMESPACE.Solana) {
    throw new Error(`Transaction history not supported for network: ${network} (${chainNamespace})`)
  }

  const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]

  if (!baseUrl) {
    throw new Error(`No Unchained URL configured for chainId: ${chainId}`)
  }

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
  })

  if (cursor) {
    params.append('cursor', cursor)
  }

  const url = `${baseUrl}/api/v1/account/${address}/txs?${params.toString()}`

  const maskedAddress = address.length > 12 ? `${address.slice(0, 5)}...${address.slice(-6)}` : address
  const safeUrl = url.replace(address, maskedAddress)
  console.log(`[getTransactionHistory] ${network} - Fetching:`, safeUrl)

  const { transactions, cursor: responseCursor } = await fetchTransactionHistory(chainNamespace, url, address, network)

  console.log(`[getTransactionHistory] ${network} - Received ${transactions.length} transactions from API`)

  return {
    transactions,
    cursor: responseCursor,
    address,
    chainId,
  }
}

export async function executeGetTransactionHistory(
  input: GetTransactionHistoryInput,
  walletContext?: WalletContext
): Promise<GetTransactionHistoryOutput> {
  console.log('[getTransactionHistory]:', input)

  const { address, network, pageSize, cursor, limit, offset, types, status, dateFrom, dateTo } = input

  // Determine networks to check (single network or all EVM/Solana networks)
  const networksToCheck = network ? [network] : getEvmSolanaNetworksFromWallet(walletContext)

  if (networksToCheck.length === 0) {
    throw new Error('No EVM or Solana wallets connected. Please connect a wallet.')
  }

  // Cursor only works for single network
  const useCursor = networksToCheck.length === 1 ? cursor : undefined

  console.log('[getTransactionHistory] Fetching from networks:', networksToCheck)
  if (address) {
    console.log('[getTransactionHistory] Using explicit address:', address.slice(0, 8) + '...')
  }

  // Fetch all networks in parallel
  const results = await Promise.allSettled(
    networksToCheck.map(net => fetchSingleNetworkHistory(net, pageSize, useCursor, walletContext, address))
  )

  // Aggregate results using reduce
  const { transactions, cursors, networksChecked, errors } = results.reduce(
    (acc, result, index) => {
      const net = networksToCheck[index]
      if (!net) return acc

      if (result.status === 'fulfilled') {
        console.log(`[getTransactionHistory] ${net}: fetched ${result.value.transactions.length} transactions`)
        result.value.transactions.forEach((tx, txIndex) => {
          console.log(
            `[getTransactionHistory] ${net} tx[${txIndex}]: type=${tx.type}, txid=${tx.txid.slice(0, 10)}..., timestamp=${tx.timestamp}`
          )
          acc.transactions.push(tx)
        })
        if (result.value.cursor) {
          acc.cursors[net] = result.value.cursor
        }
        acc.networksChecked.push(net)
      } else {
        acc.errors[net] = result.reason?.message || 'Unknown error'
        console.error(`[getTransactionHistory] Error fetching ${net}:`, result.reason)
      }

      return acc
    },
    {
      transactions: [] as ParsedTransaction[],
      cursors: {} as Record<string, string>,
      networksChecked: [] as string[],
      errors: {} as Record<string, string>,
    }
  )

  console.log(`[getTransactionHistory] Total transactions before filtering: ${transactions.length}`)

  // Apply filters
  let filteredTransactions = transactions

  if (types && types.length > 0) {
    filteredTransactions = filteredTransactions.filter(tx => types.includes(tx.type))
    console.log(`[getTransactionHistory] After type filter [${types.join(', ')}]: ${filteredTransactions.length}`)
  }

  if (status && status.length > 0) {
    filteredTransactions = filteredTransactions.filter(tx => status.includes(tx.status))
    console.log(`[getTransactionHistory] After status filter [${status.join(', ')}]: ${filteredTransactions.length}`)
  }

  if (dateFrom !== undefined) {
    filteredTransactions = filteredTransactions.filter(tx => tx.timestamp >= dateFrom)
    console.log(`[getTransactionHistory] After dateFrom filter (>=${dateFrom}): ${filteredTransactions.length}`)
  }

  if (dateTo !== undefined) {
    filteredTransactions = filteredTransactions.filter(tx => tx.timestamp <= dateTo)
    console.log(`[getTransactionHistory] After dateTo filter (<=${dateTo}): ${filteredTransactions.length}`)
  }

  // Sort all transactions by timestamp (most recent first)
  filteredTransactions.sort((a, b) => b.timestamp - a.timestamp)

  // Apply offset and limit
  const startIndex = offset || 0
  const endIndex = limit ? startIndex + limit : filteredTransactions.length
  const slicedTransactions = filteredTransactions.slice(startIndex, endIndex)

  if (startIndex > 0 || limit) {
    console.log(
      `[getTransactionHistory] Sliced transactions: offset=${startIndex}, limit=${limit || 'none'}, returning ${slicedTransactions.length} of ${filteredTransactions.length}`
    )
  }

  console.log(
    `[getTransactionHistory] Returning ${slicedTransactions.length} transactions from networks: ${networksChecked.join(', ')}`
  )
  if (slicedTransactions.length > 0) {
    console.log(
      `[getTransactionHistory] Top 3 transactions after sort:`,
      slicedTransactions.slice(0, 3).map(tx => ({
        type: tx.type,
        txid: tx.txid.slice(0, 10),
        timestamp: tx.timestamp,
      }))
    )
  }

  return {
    transactions: slicedTransactions,
    cursors: Object.keys(cursors).length > 0 ? cursors : undefined,
    networksChecked,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  }
}

export const getTransactionHistoryTool = {
  description:
    'Get transaction history for the connected wallet. If network is specified, fetches from that network only. If network is omitted, fetches from all supported networks (EVM + Solana) and returns merged results sorted by timestamp. Use pageSize to control transactions fetched per network (default 10). Use offset to skip transactions (e.g., offset=1 for second most recent). Use limit to cap total results (e.g., limit=1, offset=1 for second transaction only). Filter by types (send/receive/swap/contract), status (success/failed), or date range (dateFrom/dateTo using Unix timestamps). Returns transaction details including sends, receives, swaps, and contract interactions.',
  inputSchema: getTransactionHistorySchema,
  execute: executeGetTransactionHistory,
}
