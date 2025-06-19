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
import { AssetsStore } from '../stores/assets';
import { fromAssetId, fromChainId } from '@agentic-chat/caip';
import z from 'zod';

export const approveParamsSchema = z.object({
  assetId: z.string().describe('The token AssetId to approve'),
  spender: z
    .string()
    .describe('The address that will be approved to spend the tokens'),
  amountCryptoPrecision: z
    .string()
    .describe('Amount to approve in human format, e.g. 1 for 1 token'),
});

export type ApproveParams = z.infer<typeof approveParamsSchema>;
export type ApproveResult = string; // Tx hash

export const approve = async ({
  walletClient,
  assetId,
  spender,
  amountCryptoPrecision,
  assetsStore,
}: ApproveParams & {
  walletClient: WalletClient | undefined;
  assetsStore: AssetsStore;
}): Promise<ApproveResult> => {
  const account = walletClient?.account;
  const asset = assetsStore.assetsById[assetId];

  if (!account?.address || !walletClient) {
    throw new Error('No account connected');
  }

  const { chainId, assetReference } = fromAssetId(assetId);
  const { chainReference } = fromChainId(chainId);

  const amountCryptoBaseUnit = toBaseUnit(
    amountCryptoPrecision,
    asset.precision
  );

  try {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [getAddress(spender), BigInt(amountCryptoBaseUnit)],
    });

    const hash = await walletClient.sendTransaction({
      account: account,
      to: getAddress(assetReference),
      data,
      chain: extractChain({
        chains: networks as Chain[],
        id: Number(chainReference),
      }),
    });

    return hash;
  } catch (err) {
    console.error('Error approving token', err);
    throw err;
  }
};
