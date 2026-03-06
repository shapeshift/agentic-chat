import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { getPublicClient, getWalletClient } from '@wagmi/core'
import { getAddress } from 'viem'
import type { Hex } from 'viem'

import { chainIdToChain } from '@/lib/chains'
import { wagmiConfig } from '@/lib/wagmi-config'

import type { TransactionParams } from '../types'

export async function sendEvmTransaction(params: TransactionParams): Promise<string> {
  if (!params.chainId) throw new Error('Invalid EVM transaction: missing chainId')
  if (!params.from) throw new Error('Invalid EVM transaction: missing from address')
  if (!params.to) throw new Error('Invalid EVM transaction: missing to address')

  const { chainNamespace, chainReference } = fromChainId(params.chainId)

  if (chainNamespace !== CHAIN_NAMESPACE.Evm) {
    throw new Error(`Unsupported chain namespace for EVM transaction: ${chainNamespace}`)
  }

  const walletClient = await getWalletClient(wagmiConfig)
  if (!walletClient) {
    throw new Error('No EVM wallet connected. Please connect your wallet first.')
  }

  try {
    const chainId = Number(chainReference)
    const chain = chainIdToChain[chainId]
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }

    const publicClient = getPublicClient(wagmiConfig, { chainId })
    if (!publicClient) throw new Error('Public client not found for the specified chain')

    const account = getAddress(params.from)
    const to = getAddress(params.to)
    const value = BigInt(params.value)
    const data = params.data as Hex
    const gas = params.gasLimit ? BigInt(params.gasLimit) : undefined

    const txParams = {
      account,
      to,
      value,
      data,
      chain,
      ...(gas && { gas }),
    }

    const txHash = await walletClient.sendTransaction(txParams)
    return txHash
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`EVM transaction failed: ${error.message}`)
    }
    throw new Error('EVM transaction failed: Unknown error')
  }
}
