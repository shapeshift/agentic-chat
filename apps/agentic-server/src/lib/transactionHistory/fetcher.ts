import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { Network, ParsedTransaction } from '@shapeshiftoss/types'
import { EVM_SOLANA_NETWORKS, chainIdToNetwork, networkToChainIdMap } from '@shapeshiftoss/types'
import { getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'

import type { WalletContext } from '../../utils/walletContextSimple'

import * as cache from './cache'
import { MAX_LIMITED_FETCH_COUNT } from './constants'
import { parseEvmTransaction } from './evmParser'
import { fetchPricesForTransactions } from './pricing'
import { evmTxSchema, solanaTxSchema } from './schemas'
import { parseSolanaTransaction } from './solanaParser'
import { calculateUsdValues } from './usdCalculator'
import type { TransactionWithUsd } from './usdCalculator'

interface FetchStrategy {
  mode: 'exhaustive' | 'limited'
  maxPages: number
  reason: string
}

interface FetchInput {
  dateFrom?: number
  dateTo?: number
}

export function determineFetchStrategy(input: FetchInput): FetchStrategy {
  const hasDateRange = input.dateFrom !== undefined || input.dateTo !== undefined

  if (hasDateRange) {
    return {
      mode: 'exhaustive',
      maxPages: 100,
      reason: 'Date range specified - fetching all transactions in range',
    }
  }

  return {
    mode: 'limited',
    maxPages: 4,
    reason: 'No date range - limiting to recent transactions for performance',
  }
}

export function getEvmSolanaNetworksFromWallet(walletContext?: WalletContext): Network[] {
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

async function fetchSingleNetworkHistory(
  network: Network,
  address: string,
  strategy: FetchStrategy
): Promise<ParsedTransaction[]> {
  const chainId = networkToChainIdMap[network]
  const { chainNamespace } = fromChainId(chainId)

  if (chainNamespace !== CHAIN_NAMESPACE.Evm && chainNamespace !== CHAIN_NAMESPACE.Solana) {
    throw new Error(`Transaction history not supported for network: ${network}`)
  }

  const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]
  if (!baseUrl) {
    throw new Error(`Unchained URL not configured for ${network}`)
  }

  let allRawTxs: cache.RawTransaction[] = []
  let cursor: string | undefined
  let pageCount = 0

  while (pageCount < strategy.maxPages) {
    const cacheKey = cache.getCacheKey(address, network, cursor)
    const cachedData = cache.get(cacheKey)

    let pageData: cache.TransactionPage

    if (!cachedData) {
      const url = `${baseUrl}/api/v1/account/${address}/txs?pageSize=50${cursor ? `&cursor=${cursor}` : ''}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch ${network} transactions: ${response.statusText}`)
      }

      pageData = await response.json()
      cache.set(cacheKey, pageData)
    } else {
      pageData = cachedData
    }

    const txs = pageData.txs || []
    allRawTxs.push(...txs)
    cursor = pageData.cursor
    pageCount++

    if (!cursor) {
      break
    }

    if (strategy.mode === 'limited' && allRawTxs.length >= MAX_LIMITED_FETCH_COUNT) {
      break
    }
  }

  const parsedTxs = allRawTxs.map(tx => {
    let parsed: ParsedTransaction
    if (chainNamespace === CHAIN_NAMESPACE.Evm) {
      const validatedTx = evmTxSchema.parse(tx)
      parsed = parseEvmTransaction(validatedTx, address, network)
    } else {
      const validatedTx = solanaTxSchema.parse(tx)
      parsed = parseSolanaTransaction(validatedTx, address, network)
    }

    // Attach network to parsed transaction
    return { ...parsed, network }
  })

  return parsedTxs
}

export async function fetchTransactions(
  networks: Network[],
  addressOrWallet: string | WalletContext,
  strategy: FetchStrategy
): Promise<{
  transactions: TransactionWithUsd[]
  networksChecked: Network[]
  errors: Record<string, string>
  fetchedCount: number
}> {
  const results = await Promise.allSettled(
    networks.map(network => {
      // Resolve the correct address for this network
      const address =
        typeof addressOrWallet === 'string'
          ? addressOrWallet
          : addressOrWallet.connectedWallets?.[networkToChainIdMap[network]]?.address

      if (!address) {
        throw new Error(`No address available for network ${network}`)
      }

      return fetchSingleNetworkHistory(network, address, strategy)
    })
  )

  const allTransactions: ParsedTransaction[] = []
  const networksChecked: Network[] = []
  const errors: Record<string, string> = {}

  results.forEach((result, index) => {
    const network = networks[index]
    if (!network) return

    if (result.status === 'fulfilled') {
      allTransactions.push(...result.value)
      networksChecked.push(network)
    } else {
      errors[network] = result.reason?.message || 'Unknown error'
    }
  })

  const priceMap = await fetchPricesForTransactions(allTransactions, networksChecked)
  const transactionsWithUsd = calculateUsdValues(allTransactions, priceMap)

  return {
    transactions: transactionsWithUsd,
    networksChecked,
    errors,
    fetchedCount: transactionsWithUsd.length,
  }
}
