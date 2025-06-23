import { useAccount, useWalletClient } from 'wagmi';
import { getAddress, Hex } from 'viem';
import { useAssistantTool } from '@assistant-ui/react';
import { z } from 'zod';
import { useState } from 'react';
import { searchTokens, searchTokensParams } from '../tools/searchTokens';
import { getAllowance, getAllowanceParams } from '../tools/getAllowance';
import { approve, approveParamsSchema } from '../tools/approve';
import {
  sendTransaction,
  sendTransactionParams,
} from '../tools/sendTransaction';
import { getAccount, getAccountParams } from '../tools/getAccount';
import { bebopRateParams, getBebopRate } from '../tools/bebopRate';
import { useAssetsStore } from '../stores/assets';
import { usePortfolioStore } from '../stores/portfolio';
import { switchEvmChain, switchEvmChainParams } from '../tools/switchEvmChain';
import { executeSwap } from '../tools/executeSwap';
import { getRelayRate, relayRateParams } from '../tools/relayRate';
import { Quote } from '../types/quote';

const useTools = () => {
  const account = useAccount();
  const { data: walletClient } = useWalletClient();
  const [quote, setQuote] = useState<Quote | null>(null);

  const assetsStore = useAssetsStore();
  const portfolioStore = usePortfolioStore();

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
      });
    },
  });

  useAssistantTool({
    toolName: 'switchEvmChain',
    description: 'Switches the connected wallet to a different EVM chain',
    parameters: switchEvmChainParams,
    execute: async ({ chainId }) => {
      return switchEvmChain({
        walletClient,
        chainId,
      });
    },
  });

  useAssistantTool({
    toolName: 'approve',
    description: 'Approves a token for spending by a specific address',
    parameters: approveParamsSchema,
    execute: async (args) => {
      return approve({ walletClient, assetsStore, ...args });
    },
  });

  useAssistantTool({
    toolName: 'getAllowance',
    description: 'Gets the allowance of a token for a specific spender',
    parameters: getAllowanceParams,
    execute: async (args) => {
      return getAllowance({
        ...args,
        from: account.address,
        assetsStore,
      });
    },
  });

  useAssistantTool({
    toolName: 'searchTokens',
    description: 'Searches for tokens by name or symbol',
    parameters: searchTokensParams,
    execute: async (args) => {
      return searchTokens({ ...args, assetsStore });
    },
  });

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
      });
    },
  });

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
        // setBebopQuote,
        assetsStore,
      });
    },
  });

  useAssistantTool({
    toolName: 'executeSwap',
    description: 'Executes the swap previously requested using bebopRate tool.',
    parameters: z.object({}),
    execute: async () => {
      if (!quote) return

      return executeSwap({
        walletClient,
        ...quote,
      });
    },
  });

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
      });
    },
  });

  return null;
};

export default useTools;
