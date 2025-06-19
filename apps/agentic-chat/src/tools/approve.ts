import {
  Chain,
  encodeFunctionData,
  erc20Abi,
  extractChain,
  getAddress,
  WalletClient,
} from 'viem';
import { toBaseUnit } from '@agentic-chat/utils';
import { networks } from '../lib/appkit';

export const approve = async ({
  walletClient,
  token,
  spender,
  amountCryptoPrecision,
  chainId,
  decimals,
}: {
  walletClient: WalletClient | undefined;
  token: string;
  spender: string;
  amountCryptoPrecision: string;
  chainId: number;
  decimals: number;
}) => {
  const account = walletClient?.account;

  if (!account?.address || !walletClient) {
    throw new Error('No account connected');
  }

  const amountCryptoBaseUnit = toBaseUnit(amountCryptoPrecision, decimals);

  try {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [getAddress(spender), BigInt(amountCryptoBaseUnit)],
    });

    const hash = await walletClient.sendTransaction({
      account: account,
      to: getAddress(token),
      data,
      chain: extractChain({ chains: networks as Chain[], id: chainId }),
    });

    return hash;
  } catch (err) {
    console.error('Error approving token', err);
    throw err;
  }
};
