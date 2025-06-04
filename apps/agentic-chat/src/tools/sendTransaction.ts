import {
  Address,
  Chain,
  extractChain,
  getAddress,
  Hex,
  WalletClient,
} from 'viem';
import { networks } from '../lib/appkit';
import { getPublicClient } from '@wagmi/core';
import { wagmiConfig } from '../lib/wagmi-config';

export const sendTransaction = async ({
  walletClient,
  to,
  value,
  data,
  chainId,
}: {
  walletClient: WalletClient | undefined;
  to: Address;
  value: string;
  data: Hex;
  chainId: number;
}) => {
  const publicClient = getPublicClient(wagmiConfig, { chainId });

  if (!publicClient)
    throw new Error('Public client not found for the specified chain');

  const account = walletClient?.account;
  if (!walletClient || !account?.address) {
    throw new Error('No account connected');
  }

  try {
    // First estimate gas to catch potential errors
    const [gasLimit, gasPrice] = await Promise.all([
      publicClient.estimateGas({
        account,
        to: getAddress(to),
        value: BigInt(value),
        data: data,
      }),
      publicClient.getGasPrice(),
    ]);

    // Now send the transaction with the estimated gas
    const hash = await walletClient.sendTransaction({
      account,
      to: getAddress(to),
      value: BigInt(value),
      data: data,
      chain: extractChain({ chains: networks as Chain[], id: chainId }),
      gas: gasLimit,
      gasPrice,
    });
    return hash;
  } catch (err) {
    console.error('Error sending transaction', err);
    throw err;
  }
};
