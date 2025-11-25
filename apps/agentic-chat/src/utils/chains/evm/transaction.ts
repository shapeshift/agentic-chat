import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { getPublicClient, getWalletClient } from '@wagmi/core'
import { extractChain, getAddress } from 'viem'
import type { Chain, Hex } from 'viem'

import { networks } from '@/lib/appkit'
import { wagmiConfig } from '@/lib/wagmi-config'

import type { TransactionParams } from '../types'

export async function sendEvmTransaction(params: TransactionParams): Promise<string> {
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
    const chain = extractChain({ chains: networks as Chain[], id: chainId })

    const publicClient = getPublicClient(wagmiConfig, { chainId })
    if (!publicClient) throw new Error('Public client not found for the specified chain')

    const account = getAddress(params.from)
    const to = getAddress(params.to)
    const value = BigInt(params.value)
    const data = params.data as Hex
    const gas = params.gasLimit ? BigInt(params.gasLimit) : undefined

    const nonce = params.nonce
    const txHash = await walletClient.sendTransaction({
      account,
      to,
      value,
      data,
      chain,
      ...(gas && { gas }),
      ...(nonce !== undefined && { nonce }),
    })
    return txHash
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`EVM transaction failed: ${error.message}`)
    }
    throw new Error('EVM transaction failed: Unknown error')
  }
}
