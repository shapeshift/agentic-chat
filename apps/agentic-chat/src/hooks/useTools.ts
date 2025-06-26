import { useAssistantTool } from '@assistant-ui/react'
import type { BebopQuote } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { useState } from 'react'
import type { Hex } from 'viem'
import { getAddress } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'
import { z } from 'zod'

import { approve } from '../tools/approve'
import { getBebopRate } from '../tools/bebopRate'
import { getAccount } from '../tools/getAccount'
import { getAllowance } from '../tools/getAllowance'
import { searchTokens } from '../tools/searchTokens'
import { sendTransaction } from '../tools/sendTransaction'

const useTools = () => {
  const account = useAccount()
  const { data: walletClient } = useWalletClient()
  const [bebopQuote, setBebopQuote] = useState<BebopQuote | null>(null)

  useAssistantTool({
    toolName: 'getAccount',
    description: 'Get account information including balances and token details',
    parameters: z.object({
      network: z.string().describe('The network to get account info for (e.g., ethereum, bitcoin)'),
    }),
    execute: async ({ network }) => {
      return getAccount(account?.address, network)
    },
  })

  useAssistantTool({
    toolName: 'switchEvmChain',
    description: 'Switches the connected wallet to a different EVM chain',
    parameters: z.object({
      chainId: z.number().describe('The chain ID to switch to'),
    }),
    execute: async ({ chainId }) => {
      if (!walletClient) {
        throw new Error('No account connected')
      }

      await walletClient.switchChain({
        id: chainId,
      })

      return 'Successfully switched chain'
    },
  })

  useAssistantTool({
    toolName: 'approve',
    description: 'Approves a token for spending by a specific address',
    parameters: z.object({
      token: z.string().describe('The token contract address to approve'),
      spender: z.string().describe('The address that will be approved to spend the tokens'),
      amountCryptoPrecision: z.string().describe('Amount to approve in human format, e.g. 1 for 1 token'),
      chainId: z.number().describe('The chain ID where the token exists'),
      decimals: z.number().describe('The number of decimals the token uses'),
    }),
    execute: async args => {
      return approve({ walletClient, ...args })
    },
  })

  useAssistantTool({
    toolName: 'getAllowance',
    description: 'Gets the allowance of a token for a specific spender',
    parameters: z.object({
      token: z.string().describe('The token contract address to check allowance for'),
      decimals: z.number().describe('The number of decimals the token uses'),
      spender: z.string().describe('The address that has been approved to spend the tokens'),
      chainId: z.number().describe('The chain ID where the token exists'),
    }),
    execute: async args => {
      return getAllowance({ account, ...args })
    },
  })

  useAssistantTool({
    toolName: 'searchTokens',
    description: 'Searches for tokens by name or symbol',
    parameters: z.object({
      searchTerm: z.string().describe('The search term to find tokens by name or symbol'),
      network: z.string().optional().describe('Optional network to filter tokens by (e.g., ethereum, arbitrum)'),
    }),
    execute: async args => {
      return searchTokens(args)
    },
  })

  useAssistantTool({
    toolName: 'bebopRate',
    description: 'Fetches a swap rate from Bebop and displays it to the user',
    parameters: z.object({
      chain: z.string().describe('Chain name, e.g. ethereum, arbitrum, polygon, etc.'),
      fromAsset: z
        .object({
          address: z.string(),
          decimals: z.number(),
          symbol: z.string().optional(),
        })
        .describe('Asset to sell'),
      toAsset: z
        .object({
          address: z.string(),
          decimals: z.number(),
          symbol: z.string(),
        })
        .describe('Asset to buy'),
      sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
    }),
    execute: async ({ chain, fromAsset, toAsset, sellAmountCryptoPrecision }) => {
      return getBebopRate({
        chain,
        // @ts-expect-error partial PortalsToken type, we should move to Asset type anyway so no point to type this proper for now as this would go away
        fromAsset,
        // @ts-expect-error partial PortalsToken type, we should move to Asset type anyway so no point to type this proper for now as this would go away
        toAsset,
        sellAmountCryptoPrecision,
        fromAddress: getAddress(account?.address ?? ''),
        setBebopQuote,
      })
    },
  })

  useAssistantTool({
    toolName: 'executeSwap',
    description: 'Executes the swap previously requested using bebopRate tool.',
    parameters: z.object({}),
    execute: async () => {
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
    },
  })

  useAssistantTool({
    toolName: 'sendTransaction',
    description: 'Sends a transaction to the blockchain',
    parameters: z.object({
      to: z.string().describe('The address to send the transaction to'),
      valueCryptoPrecision: z.string().describe('Amount to send in human format, e.g. 1 for 1 ETH'),
      data: z.string().describe('The transaction data (hex string)'),
      chainId: z.number().describe('The chain ID where the transaction will be sent'),
    }),
    execute: async ({ to, valueCryptoPrecision, data, chainId }) => {
      const valueCryptoBaseUnit = toBaseUnit(
        valueCryptoPrecision,
        18 // Assuming 18 decimals for ETH-like transactions
      )

      return sendTransaction({
        walletClient,
        to: getAddress(to),
        value: valueCryptoBaseUnit,
        data: data as Hex,
        chainId,
      })
    },
  })

  return null
}

export default useTools
