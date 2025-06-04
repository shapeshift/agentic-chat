import { useAccount, useWalletClient } from 'wagmi';
import { Address, getAddress, Hex } from 'viem';
import { ToolCall } from '@ai-sdk/provider-utils';
import { BebopQuote } from '@agentic-chat/types';

import { useState } from 'react';
import { getAccount } from '../tools/getAccount';
import { switchEvmChain } from '../tools/switchEvmChain';
import { searchTokens } from '../tools/searchTokens';
import { getBebopRate } from '../tools/bebopRate';
import { getAllowance } from '../tools/getAllowance';
import { approve } from '../tools/approve';
import { sendTransaction } from '../tools/sendTransaction';
import { toBaseUnit } from '@agentic-chat/utils';

const env = import.meta?.env ? import.meta.env : process.env;

const BEBOP_API_KEY = env.VITE_BEBOP_API_KEY;

const useTools = () => {
  const account = useAccount();
  const { data: walletClient } = useWalletClient();
  const [bebopQuote, setBebopQuote] = useState<BebopQuote | null>(null);

  const handleToolCall = async ({
    toolCall,
  }: {
    toolCall: ToolCall<string, unknown>;
  }) => {
    if (!BEBOP_API_KEY) {
      throw new Error('Missing env vars');
    }

    switch (toolCall.toolName) {
      case 'getAddress': {
        return account.address;
      }

      case 'getAccount': {
        return getAccount(account, toolCall);
      }

      case 'switchEvmChain': {
        return switchEvmChain(walletClient, toolCall);
      }

      case 'searchTokens': {
        return searchTokens(toolCall);
      }

      case 'bebopRate': {
        return getBebopRate({ toolCall, setBebopQuote });
      }

      case 'getAllowance': {
        return getAllowance(account, toolCall);
      }

      case 'approve': {
        return approve(walletClient, toolCall);
      }

      case 'sendTransaction': {
        const typedToolCall = toolCall as ToolCall<
          'sendTransaction',
          {
            to: Address;
            valueCryptoPrecision: string;
            data: Hex;
            chainId: number;
          }
        >;

        const { to, valueCryptoPrecision, data, chainId } = typedToolCall.args;

        const valueCryptoBaseUnit = toBaseUnit(
          valueCryptoPrecision,
          18 // Assuming 18 decimals for ETH-like transactions
        );

        return sendTransaction({
          walletClient,
          value: valueCryptoBaseUnit,
          data,
          chainId,
          to,
        });
      }

      case 'executeSwap': {
        if (!bebopQuote) {
          throw new Error('No quote available');
        }

        const { chainId, tx } = bebopQuote;
        const { to, value, data } = tx;

        return sendTransaction({
          walletClient,
          to: getAddress(to),
          value: value,
          data,
          chainId,
        });
      }

      default:
        return 'Tool not implemented';
    }
  };

  return { handleToolCall };
};

export default useTools;
