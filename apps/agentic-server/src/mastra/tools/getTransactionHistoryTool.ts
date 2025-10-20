import { createTool } from '@mastra/core'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { networkToChainIdMap } from '@shapeshiftoss/types'
import { getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'

import { getAddressForNetwork } from '../../utils/walletContext'

import {
  fetchEvmTransactionHistory,
  fetchSolanaTransactionHistory,
  getTransactionHistoryInput,
  getTransactionHistoryOutput,
} from './transactionHistory'
import type { ParsedTransaction } from './transactionHistory'

export type { GetTransactionHistoryInput, GetTransactionHistoryOutput } from './transactionHistory'

async function fetchTransactionHistory(
  chainNamespace: string,
  url: string,
  address: string
): Promise<{ transactions: ParsedTransaction[]; cursor?: string }> {
  if (chainNamespace === CHAIN_NAMESPACE.Evm) {
    return fetchEvmTransactionHistory(url, address)
  }

  if (chainNamespace === CHAIN_NAMESPACE.Solana) {
    return fetchSolanaTransactionHistory(url, address)
  }

  throw new Error(`Transaction history not supported for chain namespace: ${chainNamespace}`)
}

export const getTransactionHistoryTool = createTool({
  id: 'getTransactionHistoryTool',
  description:
    'Get transaction history for the connected wallet on a specific network. Returns recent transactions with details about sends, receives, swaps, and contract interactions.',
  inputSchema: getTransactionHistoryInput,
  outputSchema: getTransactionHistoryOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger()

    logger?.info('getTransactionHistoryTool:', { context })

    const { network, pageSize, cursor } = context
    const chainId = networkToChainIdMap[network]
    const address = getAddressForNetwork(runtimeContext, network)
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
    logger?.info('Fetching transaction history:', { url: safeUrl })

    const { transactions, cursor: responseCursor } = await fetchTransactionHistory(chainNamespace, url, address)

    return {
      address,
      chainId,
      transactions,
      cursor: responseCursor,
    }
  },
})
