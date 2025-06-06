import { UseAccountReturnType } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { wagmiConfig } from '../lib/wagmi-config';
import { erc20Abi, getAddress } from 'viem';
import { fromBaseUnit } from '@agentic-chat/utils';

export const getAllowance = async ({
  account,
  token,
  decimals,
  spender,
  chainId,
}: {
  account: UseAccountReturnType;
  token: string;
  decimals: number;
  spender: string;
  chainId: number;
}) => {
  if (!account.address) {
    throw new Error('No account connected');
  }

  const publicClient = getPublicClient(wagmiConfig, { chainId });

  if (!publicClient)
    throw new Error('Public client not found for the specified chain');

  const allowance = await publicClient.readContract({
    address: getAddress(token),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, getAddress(spender)],
  });

  return fromBaseUnit(allowance.toString(), decimals);
};
