import {
  Asset,
  BebopQuote,
  BebopResponse,
  PortalsToken,
} from '@agentic-chat/types';
import { fromBaseUnit, toBaseUnit } from '@agentic-chat/utils';
import { ToolCall } from '@ai-sdk/provider-utils';
import {
  ASSET_NAMESPACE,
  CHAIN_NAMESPACE,
  toAssetId,
} from '@agentic-chat/caip';
import type { ChainId } from '@agentic-chat/caip';
import { Address, getAddress } from 'viem';

const BEBOP_ETH_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const getBebopRate = async ({
  toolCall,
  setBebopQuote,
}: {
  toolCall: ToolCall<string, unknown>;
  setBebopQuote: (bebopQuote: BebopQuote) => void;
}) => {
  const typedToolCall = toolCall as ToolCall<
    'bebopRate',
    {
      sellAmountCryptoPrecision: string;
      fromAsset: PortalsToken;
      toAsset: PortalsToken;
      fromAddress: Address;
      chain: string;
    }
  >;
  const { sellAmountCryptoPrecision, fromAsset, toAsset, fromAddress, chain } =
    typedToolCall.args;

  const bebopChainsMap: Record<string, string> = {
    ethereum: 'ethereum',
    polygon: 'polygon',
    arbitrum: 'arbitrum',
    base: 'base',
    avalanche: 'avalanche',
    optimism: 'optimism',
    bsc: 'bsc',
  };

  const sellAmountCryptoBaseUnit = toBaseUnit(
    sellAmountCryptoPrecision,
    fromAsset.decimals
  );

  // Convert ETH symbol to Bebop's ETH marker address
  const sellTokenAddress = getAddress(
    fromAsset.symbol.trim().toUpperCase() === 'ETH'
      ? BEBOP_ETH_MARKER
      : fromAsset.address
  );
  const buyTokenAddress = getAddress(
    toAsset.symbol.trim().toUpperCase() === 'ETH'
      ? BEBOP_ETH_MARKER
      : toAsset.address
  );

  const env = import.meta?.env ? import.meta.env : process.env;

  const BEBOP_API_KEY = env.VITE_BEBOP_API_KEY || env.BEBOP_API_KEY;

  const url = `https://api.bebop.xyz/router/${
    bebopChainsMap[chain] ?? chain
  }/v1/quote`;
  const takerAddress = fromAddress;
  const reqParams = new URLSearchParams({
    sell_tokens: sellTokenAddress,
    buy_tokens: buyTokenAddress,
    sell_amounts: sellAmountCryptoBaseUnit,
    taker_address: takerAddress,
    approval_type: 'Standard',
    skip_validation: 'true',
    gasless: 'false',
    source: 'shapeshift',
  });

  const fullUrl = `${url}?${reqParams.toString()}`;
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'source-auth': BEBOP_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Bebop rate: ${response.statusText}`);
  }

  const data = (await response.json()) as BebopResponse;

  if (!data.routes?.[0]?.quote) {
    throw new Error('No routes found in Bebop response');
  }

  const quote = data.routes[0].quote;

  setBebopQuote(quote);

  const buyAmountCryptoBaseUnit =
    quote.buyTokens[buyTokenAddress].amount.toString();
  const buyAmountCryptoPrecision = fromBaseUnit(
    buyAmountCryptoBaseUnit,
    quote.buyTokens[buyTokenAddress].decimals
  );

  const sellToken = Object.values(quote.sellTokens)[0];
  const buyToken = Object.values(quote.buyTokens)[0];

  // TODO(gomes): re-declare caip from web as a monorepo package here, but this will work for now
  // published caip is way too old and misses many chains
  const chainId = `${CHAIN_NAMESPACE.Evm}:${quote.chainId}` as ChainId;
  const sellAssetId = toAssetId({
    chainId,
    assetNamespace: ASSET_NAMESPACE.erc20,
    assetReference: sellToken.address ?? BEBOP_ETH_MARKER,
  });
  const buyAssetId = toAssetId({
    chainId,
    assetNamespace: ASSET_NAMESPACE.erc20,
    assetReference: buyToken.address ?? BEBOP_ETH_MARKER,
  });

  const sellAsset: Asset = {
    name: sellToken.name ?? '',
    symbol: sellToken.symbol,
    precision: sellToken.decimals,
    chainId,
    assetId: sellAssetId,
  };
  const buyAsset: Asset = {
    name: buyToken.name ?? '',
    symbol: buyToken.symbol,
    precision: buyToken.decimals,
    chainId,
    assetId: buyAssetId,
  };

  const content = {
    sellAmountCryptoPrecision,
    buyAmountCryptoPrecision,
    sellAsset,
    buyAsset,
    approvalTarget: quote.approvalTarget,
  };

  return content;
};
