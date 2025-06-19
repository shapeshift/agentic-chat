import { getAddress, Hash } from 'viem';
import { sendTransaction } from './sendTransaction';
import { WalletClient } from 'viem';
import { BebopQuote } from '@agentic-chat/types';
import z from 'zod';

export const bebopQuoteParams = z.object({});
export type BebopQuoteParams = z.infer<typeof bebopQuoteParams>;
export type BebopQuoteResult = Hash;

export const executeSwap = async ({
  bebopQuote,
  walletClient,
}: BebopQuoteParams & {
  bebopQuote: BebopQuote | null;
  walletClient: WalletClient | undefined;
}): Promise<BebopQuoteResult> => {
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
};
