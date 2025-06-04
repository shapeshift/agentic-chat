import { UseAccountReturnType } from 'wagmi';
import { ToolCall } from '@ai-sdk/provider-utils';
import { getPublicClient } from '@wagmi/core';
import { wagmiConfig } from '../lib/wagmi-config';
import { erc20Abi, getAddress } from 'viem';

export const getAllowance = async (
  account: UseAccountReturnType,
  toolCall: ToolCall<string, unknown>
) => {
  if (!account.address) {
    throw new Error('No account connected');
  }

  const typedToolCall = toolCall as ToolCall<
    'getAllowance',
    {
      token: string;
      spender: string;
      chainId: number;
    }
  >;
  const { token, spender, chainId } = typedToolCall.args;

  const publicClient = getPublicClient(wagmiConfig, { chainId });

  if (!publicClient)
    throw new Error('Public client not found for the specified chain');

  const allowance = await publicClient.readContract({
    address: getAddress(token),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, getAddress(spender)],
  });

  return allowance.toString();
};
