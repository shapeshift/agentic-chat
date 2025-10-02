import { fromChainId } from '@shapeshiftoss/caip'
import type { ChainId } from '@shapeshiftoss/caip'
import { getPublicClient } from '@wagmi/core'
import { extractChain, getAddress } from 'viem'
import type { Chain, Hex, WalletClient } from 'viem'
import { mainnet, optimism, arbitrum, polygon, avalanche, bsc, base, gnosis } from 'viem/chains'

import { wagmiConfig } from '@/lib/wagmi-config'

// Convert your network names to viem Chain objects
const networks: Chain[] = [
  mainnet, // ethereum
  optimism,
  arbitrum,
  polygon,
  avalanche,
  bsc,
  base,
  gnosis,
  // Note: Solana isn't supported by viem as it's not an EVM chain
]

type SendTransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  gasLimit?: number
  walletClient: WalletClient
}

export const sendTransaction = async (params: SendTransactionParams) => {
  const { walletClient } = params
  const chainId = Number(fromChainId(params.chainId).chainReference)
  const chain = extractChain({ chains: networks, id: chainId })
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
