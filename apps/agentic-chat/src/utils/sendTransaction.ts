import { fromChainId } from '@shapeshiftoss/caip'
import type { ChainId } from '@shapeshiftoss/caip'
import { getPublicClient } from '@wagmi/core'
import { extractChain, getAddress } from 'viem'
import type { Chain, Hex, WalletClient } from 'viem'

import { networks } from '@/lib/appkit'
import { wagmiConfig } from '@/lib/wagmi-config'

type SendTransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  walletClient: WalletClient
}

export const sendTransaction = async (params: SendTransactionParams) => {
  const { walletClient } = params

  const chainId = Number(fromChainId(params.chainId).chainReference)
  const chain = extractChain({ chains: networks as Chain[], id: chainId })

  const publicClient = getPublicClient(wagmiConfig, { chainId })
  if (!publicClient) throw new Error('Public client not found for the specified chain')

  const account = getAddress(params.from)
  const to = getAddress(params.to)
  const value = BigInt(params.value)
  const data = params.data as Hex

  try {
    // First estimate gas to catch potential errors
    const [gas, gasPrice] = await Promise.all([
      publicClient.estimateGas({ account, to, value, data }),
      publicClient.getGasPrice(),
    ])

    return await walletClient.sendTransaction({ account, to, value, data, chain, gas, gasPrice })
  } catch (err) {
    console.error('Error sending transaction', err)
    throw err
  }
}
