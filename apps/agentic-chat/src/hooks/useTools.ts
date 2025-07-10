import { useAssistantTool } from '@assistant-ui/react'
import { useCallback, useState } from 'react'
import { getAddress } from 'viem'
import type { Hex } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'

import { useAssetsStore } from '../stores/assets'
import { usePortfolioStore } from '../stores/portfolio'
import { approve, approveParamsSchema } from '../tools/approve'
import { bebopRateParams, getBebopRate } from '../tools/bebopRate'
import { executeSwap, executeSwapParams } from '../tools/executeSwap'
import { getAccount, getAccountParams } from '../tools/getAccount'
import { getAllowance, getAllowanceParams } from '../tools/getAllowance'
import { getRelayRate, relayRateParams } from '../tools/relayRate/index'
import { searchTokens, searchTokensParams } from '../tools/searchTokens'
import { sendTransaction, sendTransactionParams } from '../tools/sendTransaction'
import { switchEvmChain, switchEvmChainParams } from '../tools/switchEvmChain'
import type { Quote, Quotes } from '../types'

const useTools = () => {
  const account = useAccount()
  const { data: walletClient } = useWalletClient()
  const [quotes, setQuotes] = useState<Quotes>({})

  const setQuote = useCallback((quote: Quote) => {
    setQuotes(prev => ({ ...prev, [quote.id]: quote }))
  }, [])

  const assetsStore = useAssetsStore()
  const portfolioStore = usePortfolioStore()

  useAssistantTool({
    toolName: 'getAccount',
    description: 'Get account information including balances and token details',
    parameters: getAccountParams,
    execute: async ({ network }) => {
      return getAccount({
        address: account?.address,
        network,
        assetsStore,
        portfolioStore,
      })
    },
  })

  useAssistantTool({
    toolName: 'switchEvmChain',
    description: 'Switches the connected wallet to a different EVM chain',
    parameters: switchEvmChainParams,
    execute: async ({ chainId }) => {
      return switchEvmChain({
        walletClient,
        chainId,
      })
    },
  })

  useAssistantTool({
    toolName: 'approve',
    description: 'Approves a token for spending by a specific address',
    parameters: approveParamsSchema,
    execute: async args => {
      return approve({ walletClient, assetsStore, ...args })
    },
  })

  useAssistantTool({
    toolName: 'getAllowance',
    description: 'Gets the allowance of a token for a specific spender',
    parameters: getAllowanceParams,
    execute: async args => {
      return getAllowance({
        ...args,
        from: account.address,
        assetsStore,
      })
    },
  })

  useAssistantTool({
    toolName: 'searchTokens',
    description: 'Searches for tokens by name or symbol',
    parameters: searchTokensParams,
    execute: async args => {
      return searchTokens({ ...args, assetsStore })
    },
  })

  useAssistantTool({
    toolName: 'bebopRate',
    description: 'Fetches a swap rate from Bebop and displays it to the user',
    parameters: bebopRateParams,
    execute: async ({ sellAssetId, buyAssetId, sellAmountCryptoPrecision }) => {
      return getBebopRate({
        sellAssetId,
        buyAssetId,
        sellAmountCryptoPrecision,
        fromAddress: getAddress(account?.address ?? ''),
        setQuote,
        assetsStore,
      })
    },
  })

  useAssistantTool({
    toolName: 'relayRate',
    description: 'Fetches a swap rate from Relay and displays it to the user',
    parameters: relayRateParams,
    execute: async ({ sellAssetId, buyAssetId, sellAmountCryptoPrecision }) => {
      return getRelayRate({
        sellAssetId,
        buyAssetId,
        sellAmountCryptoPrecision,
        fromAddress: getAddress(account?.address ?? ''),
        setQuote,
        assetsStore,
      })
    },
  })

  useAssistantTool({
    toolName: 'executeSwap',
    description: 'Executes the swap previously requested using bebopRate tool.',
    parameters: executeSwapParams,
    execute: async ({ quoteId }) => {
      const quote = quotes[quoteId]

      if (!quote) return

      return executeSwap({
        walletClient,
        ...quote,
      })
    },
  })

  useAssistantTool({
    toolName: 'sendTransaction',
    description: 'Sends a transaction to the blockchain',
    parameters: sendTransactionParams,
    execute: async ({ to, valueCryptoPrecision, data, chainId }) => {
      return sendTransaction({
        walletClient,
        to: getAddress(to),
        valueCryptoPrecision,
        data: data as Hex,
        chainId,
      })
    },
  })

  return null
}

export default useTools
