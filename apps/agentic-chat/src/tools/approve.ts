import type { ToolCall } from '@ai-sdk/provider-utils'
import { toBaseUnit } from '@shapeshiftoss/utils'
import type { Chain, WalletClient } from 'viem'
import { encodeFunctionData, erc20Abi, extractChain, getAddress } from 'viem'

import { networks } from '../lib/appkit'

export const approve = async (walletClient: WalletClient | undefined, toolCall: ToolCall<string, unknown>) => {
  const account = walletClient?.account

  if (!account?.address || !walletClient) {
    throw new Error('No account connected')
  }

  const typedToolCall = toolCall as ToolCall<
    'approve',
    {
      token: string
      spender: string
      amountCryptoPrecision: string
      chainId: number
      decimals: number
    }
  >

  const { token, spender, amountCryptoPrecision, decimals, chainId } = typedToolCall.args

  const amountCryptoBaseUnit = toBaseUnit(amountCryptoPrecision, decimals)

  try {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [getAddress(spender), BigInt(amountCryptoBaseUnit)],
    })

    const hash = await walletClient.sendTransaction({
      account: account,
      to: getAddress(token),
      data,
      chain: extractChain({ chains: networks as Chain[], id: chainId }),
    })

    return hash
  } catch (err) {
    console.error('Error approving token', err)
    throw err
  }
}
