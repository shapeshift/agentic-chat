import { v4 as uuid } from 'uuid';
import axios from 'axios';
import { fromBaseUnit, toBaseUnit } from '@agentic-chat/utils';
import {
  arbitrumAssetId,
  arbitrumChainId,
  avalancheAssetId,
  avalancheChainId,
  baseAssetId,
  baseChainId,
  bscAssetId,
  bscChainId,
  ethAssetId,
  ethChainId,
  fromAssetId,
  gnosisAssetId,
  gnosisChainId,
  optimismAssetId,
  isAssetReference,
  optimismChainId,
  polygonAssetId,
  polygonChainId,
  fromChainId,
} from '@shapeshiftoss/caip';
import type { AssetId } from '@shapeshiftoss/caip';
import { Address, zeroAddress } from 'viem';
import { AssetsStore } from '../../stores/assets';
import z from 'zod';
import { Asset } from '../../types/asset';
import { Quote } from '../../types/quote';
import { RelayFetchQuoteParams, RelayQuote } from './types';

export const relayRateParams = z.object({
  sellAssetId: z.string().describe('The sell AssetID to fetch rate for'),
  buyAssetId: z.string().describe('The buy AssetID to fetch rate for'),
  sellAmountCryptoPrecision: z
    .string()
    .describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
});

export type RelayRateParams = z.infer<typeof relayRateParams>;
export type RelayRateResult = {
  sellAmountCryptoPrecision: string;
  buyAmountCryptoPrecision: string;
  sellAssetId: AssetId;
  buyAssetId: AssetId;
  approvalTarget: string | undefined;
};

const isNativeEvmAsset = (assetId: AssetId): boolean => {
  const { chainId } = fromAssetId(assetId);
  switch (chainId) {
    case ethChainId:
      return assetId === ethAssetId;
    case avalancheChainId:
      return assetId === avalancheAssetId;
    case optimismChainId:
      return assetId === optimismAssetId;
    case bscChainId:
      return assetId === bscAssetId;
    case polygonChainId:
      return assetId === polygonAssetId;
    case gnosisChainId:
      return assetId === gnosisAssetId;
    case arbitrumChainId:
      return assetId === arbitrumAssetId;
    case baseChainId:
      return assetId === baseAssetId;
    default:
      return false;
  }
};

const getRelayAssetAddress = (asset: Asset): Address => {
  if (isNativeEvmAsset(asset.assetId)) return zeroAddress;
  const { assetReference } = fromAssetId(asset.assetId);

  return isAssetReference(assetReference)
    ? zeroAddress
    : (assetReference as Address);
};

export const getRelayRate = async ({
  sellAssetId,
  buyAssetId,
  sellAmountCryptoPrecision,
  fromAddress,
  setQuote,
  assetsStore,
}: RelayRateParams & {
  fromAddress: Address;
  setQuote: (quote: Quote) => void;
  assetsStore: AssetsStore;
}): Promise<RelayRateResult> => {
  const sellAsset = assetsStore.assetsById[sellAssetId];
  const buyAsset = assetsStore.assetsById[buyAssetId];

  if (!(sellAsset && buyAsset)) {
    throw new Error('AssetIds not found');
  }

  const chainId = fromAssetId(sellAssetId).chainId;
  const networkId = fromChainId(chainId).chainReference;

  const sellAmountCryptoBaseUnit = toBaseUnit(
    sellAmountCryptoPrecision,
    sellAsset.precision
  );

  const url = `https://api.relay.link/quote`;
  const params: RelayFetchQuoteParams = {
    user: fromAddress,
    recipient: fromAddress,
    refundTo: fromAddress,
    refundOnOrigin: true,
    originChainId: Number(networkId),
    originCurrency: getRelayAssetAddress(sellAsset),
    destinationCurrency: getRelayAssetAddress(buyAsset),
    destinationChainId: Number(networkId),
    tradeType: 'EXACT_INPUT',
    amount: sellAmountCryptoBaseUnit,
    slippageTolerance: undefined,
    // TODO(gomes): affiliate, none for the time being for devving
    appFees: [],
  };

  const { data } = await axios.post<RelayQuote>(url, params);

  const buyAmountCryptoBaseUnit = data.details.currencyOut.amount;
  const buyAmountCryptoPrecision = fromBaseUnit(
    buyAmountCryptoBaseUnit,
    buyAsset.precision
  );

  const maybeApprovalStep = data.steps.find((step) => step.id === 'approve');
  const swapSteps = data.steps.filter((step) => step.id !== 'approve');

  if (swapSteps.length > 1)
    throw new Error('Multi-hop not supported for Relay');

  const swapStep = swapSteps[0];
  const txData = swapStep.items?.[0]?.data;

  if (!txData) throw new Error('No transaction data found in Relay quote');
  const { to, data: calldata, value } = txData;
  if (!to) throw new Error('No "to" address found in Relay quote');
  if (!value) throw new Error('No "value" found in Relay quote');
  if (!calldata) throw new Error('No "data" found in Relay quote');

  const id = uuid();

  const content = {
    sellAmountCryptoPrecision,
    buyAmountCryptoPrecision,
    sellAssetId,
    buyAssetId,
    approvalTarget:
      swapStep && maybeApprovalStep ? swapStep.items?.[0]?.data?.to : undefined,
    id,
  };

  setQuote({
    ...content,
    tx: {
      to,
      value,
      data: calldata,
      from: fromAddress,
      chainId: Number(networkId),
    },
    id,
  });

  return content;
};
