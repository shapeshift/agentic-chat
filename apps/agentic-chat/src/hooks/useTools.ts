import type { ToolCall } from '@ai-sdk/provider-utils'
import type { BebopQuote } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { useState } from 'react'
import type { Address, Hex } from 'viem'
import { getAddress } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'

import { approve } from '../tools/approve'
import { getBebopRate } from '../tools/bebopRate'
import { getAccount } from '../tools/getAccount'
import { getAllowance } from '../tools/getAllowance'
import { searchTokens } from '../tools/searchTokens'
import { sendTransaction } from '../tools/sendTransaction'
import { switchEvmChain } from '../tools/switchEvmChain'

const useTools = () => {
  const account = useAccount()
  const { data: walletClient } = useWalletClient()
  const [bebopQuote, setBebopQuote] = useState<BebopQuote | null>(null)

  const handleToolCall = async ({ toolCall }: { toolCall: ToolCall<string, unknown> }) => {
    switch (toolCall.toolName) {
      case 'getAddress': {
        return account.address
      }

      case 'getAccount': {
        return getAccount(account, toolCall)
      }

      case 'switchEvmChain': {
        return switchEvmChain(walletClient, toolCall)
      }

      case 'searchTokens': {
        return searchTokens(toolCall)
      }

      case 'bebopRate': {
        return getBebopRate({ toolCall, setBebopQuote })
      }

      case 'getAllowance': {
        return getAllowance(account, toolCall)
      }

      case 'approve': {
        return approve(walletClient, toolCall)
      }

      case 'sendTransaction': {
        const typedToolCall = toolCall as ToolCall<
          'sendTransaction',
          {
            to: Address
            valueCryptoPrecision: string
            data: Hex
            chainId: number
          }
        >

        const { to, valueCryptoPrecision, data, chainId } = typedToolCall.args

        const valueCryptoBaseUnit = toBaseUnit(
          valueCryptoPrecision,
          18 // Assuming 18 decimals for ETH-like transactions
        )

        return sendTransaction({
          walletClient,
          value: valueCryptoBaseUnit,
          data,
          chainId,
          to,
        })
      }

      case 'executeSwap': {
        if (!bebopQuote) {
          throw new Error('No quote available')
        }

        const { chainId, tx } = bebopQuote
        const { to, value, data } = tx

        return sendTransaction({
          walletClient,
          to: getAddress(to),
          value: value,
          data,
          chainId,
        })
      }

      default:
        return 'Tool not implemented'
    }
  }

  return { handleToolCall }
}

export default useTools
