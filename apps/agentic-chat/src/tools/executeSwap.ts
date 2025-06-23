import { fromBaseUnit } from '@agentic-chat/utils';
import { getAddress, Hash } from 'viem';
import { sendTransaction } from './sendTransaction';
import { WalletClient } from 'viem';
import z from 'zod';
import { Quote } from '../types/quote';

export const bebopQuoteParams = z.object({});
export type BebopQuoteParams = z.infer<typeof bebopQuoteParams>;
export type ExecuteSwapResult = Hash;

export const executeSwap = async ({
  walletClient,
  tx,
}: BebopQuoteParams & {
  walletClient: WalletClient | undefined;
} & Quote): Promise<ExecuteSwapResult> => {
  const { chainId, to, value, data } = tx;

  const valueCryptoPrecision = fromBaseUnit(value, 18); // Assuming 18 decimals for native token

  return sendTransaction({
    walletClient,
    to: getAddress(to),
    valueCryptoPrecision,
    data,
    chainId,
  });
};
