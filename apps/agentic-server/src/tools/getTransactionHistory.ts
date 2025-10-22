import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { networkToChainIdMap } from '@shapeshiftoss/types'
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
  address: string
  chainId: string
  transactions: ParsedTransaction[]
  cursor?: string
}

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

export async function executeGetTransactionHistory(
  input: GetTransactionHistoryInput,
  walletContext?: WalletContext
): Promise<GetTransactionHistoryOutput> {
  console.log('[getTransactionHistory]:', input)

  const { network, pageSize, cursor } = input
  const chainId = networkToChainIdMap[network]
  const address = getAddressForNetwork(walletContext, network)
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
  console.log('[getTransactionHistory] Fetching:', safeUrl)

  const { transactions, cursor: responseCursor } = await fetchTransactionHistory(chainNamespace, url, address)

  return {
    address,
    chainId,
    transactions,
    cursor: responseCursor,
  }
}

export const getTransactionHistoryTool = {
  description:
    'Get transaction history for the connected wallet on a specific network. Returns recent transactions with details about sends, receives, swaps, and contract interactions.',
  inputSchema: getTransactionHistorySchema,
  execute: executeGetTransactionHistory,
}
