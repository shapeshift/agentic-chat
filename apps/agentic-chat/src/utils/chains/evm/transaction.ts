import { fromChainId } from '@shapeshiftoss/caip'
import { getPublicClient, getWalletClient } from '@wagmi/core'
import { extractChain, getAddress } from 'viem'
import type { Chain, Hex } from 'viem'

import { networks } from '@/lib/appkit'
import { wagmiConfig } from '@/lib/wagmi-config'

import type { TransactionParams } from '../types'

export async function sendEvmTransaction(params: TransactionParams): Promise<string> {
  const walletClient = await getWalletClient(wagmiConfig)
  if (!walletClient) {
    throw new Error('No EVM wallet connected')
  }

  const chainId = Number(fromChainId(params.chainId).chainReference)
  const chain = extractChain({ chains: networks as Chain[], id: chainId })

  const publicClient = getPublicClient(wagmiConfig, { chainId })
  if (!publicClient) throw new Error('Public client not found for the specified chain')

  const account = getAddress(params.from)
  const to = getAddress(params.to)
  const value = BigInt(params.value)
  const data = params.data as Hex
  const gasLimit = params.gasLimit

  const gasPrice = await publicClient.getGasPrice()
  const gas = gasLimit ? BigInt(gasLimit) : await publicClient.estimateGas({ account, to, value, data })

  return await walletClient.sendTransaction({ account, to, value, data, chain, gas, gasPrice })
}
