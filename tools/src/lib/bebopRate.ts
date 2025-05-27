import { fromBaseUnit } from '@agentic-chat/utils';
import { tool } from '@langchain/core/tools';
import { getAddress } from 'viem';
import { z } from 'zod';
import { Asset, BebopResponse } from './types';
import {
  ASSET_NAMESPACE,
  AssetId,
  CHAIN_NAMESPACE,
  ChainId,
} from '@shapeshiftoss/caip';

const BEBOP_ETH_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const bebopRate = tool(
  async (input: {
    chain: string;
    fromAsset: {
      address: string;
      precision: number;
      name: string;
      symbol: string;
    };
    toAsset: {
      address: string;
      precision: number;
      name: string;
      symbol: string;
    };
    sellAmountCryptoBaseUnit: string;
    fromAddress?: string;
  }) => {
    const bebopChainsMap: Record<string, string> = {
      ethereum: 'ethereum',
      polygon: 'polygon',
      arbitrum: 'arbitrum',
      base: 'base',
      avalanche: 'avalanche',
      optimism: 'optimism',
      bsc: 'bsc',
    };

    // Convert ETH symbol to Bebop's ETH marker address
    const sellTokenAddress = getAddress(
      input.fromAsset.symbol.trim().toUpperCase() === 'ETH'
        ? BEBOP_ETH_MARKER
        : input.fromAsset.address
    );
    const buyTokenAddress = getAddress(
      input.toAsset.symbol.trim().toUpperCase() === 'ETH'
        ? BEBOP_ETH_MARKER
        : input.toAsset.address
    );

    const env = import.meta?.env ? import.meta.env : process.env;

    const BEBOP_API_KEY = env.VITE_BEBOP_API_KEY || env.BEBOP_API_KEY;

    const url = `https://api.bebop.xyz/router/${
      bebopChainsMap[input.chain] ?? input.chain
    }/v1/quote`;
    const takerAddress =
      input.fromAddress || '0x0000000000000000000000000000000000000001';
    const reqParams = new URLSearchParams({
      sell_tokens: sellTokenAddress,
      buy_tokens: buyTokenAddress,
      sell_amounts: input.sellAmountCryptoBaseUnit,
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
        ['source-auth']: BEBOP_API_KEY,
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

    const buyAmountCryptoBaseUnit =
      quote.buyTokens[buyTokenAddress].amount.toString();

    const sellToken = Object.values(quote.sellTokens)[0];
    const buyToken = Object.values(quote.buyTokens)[0];
    // TODO(gomes): re-declare caip from web as a monorepo package here, but this will work for now
    // published caip is way too old and misses many chains
    const chainId = `${CHAIN_NAMESPACE.Evm}:${quote.chainId}` as ChainId;
    const sellAssetId =
      `${chainId}/${ASSET_NAMESPACE.erc20}:${sellToken.address}` as AssetId;
    const buyAssetId =
      `${chainId}/${ASSET_NAMESPACE.erc20}:${buyToken.address}` as AssetId;
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
      sellAmountCryptoBaseUnit: input.sellAmountCryptoBaseUnit,
      buyAmountCryptoBaseUnit,
      sellAsset,
      buyAsset,
      txData: quote.tx,
    };

    const artifacts = {
      swapperName: 'bebop',
      sellAmountCryptoBaseUnit: input.sellAmountCryptoBaseUnit,
      buyAmountCryptoBaseUnit,
      txData: quote.tx,
    };

    return [content, artifacts];
  },
  {
    name: 'bebopRate',
    description: `
    Fetches a swap rate from Bebop and displays it to the user.
    Returns an object with the following fields:
    - sellAmountCryptoBaseUnit: The sell amount in base unit for that token or native asset
    - buyAmountCryptoBaseUnit: The buy amount in base unit for that token or native asset
    - swapperName: The name of the swapper (e.g., 'Bebop'). **Internal use only.**
    - txData: Transaction data for use in sendTransaction() tool. Do not trim, do not pad the data field.

    **Instructions for LLM:**
    - Only display sell amount and buy amount. The rest is not user-facing.
    - If the user requests technical details, you may show base unit values and other internal fields.
`,
    schema: z.object({
      chain: z
        .string()
        .describe('Chain name, e.g. ethereum, arbitrum, polygon, etc.'),
      fromAsset: z
        .object({
          address: z.string(),
          precision: z.number(),
          name: z.string(),
          symbol: z.string(),
        })
        .describe('Asset to sell'),
      toAsset: z
        .object({
          address: z.string(),
          precision: z.number(),
          name: z.string(),
          symbol: z.string(),
        })
        .describe('Asset to buy'),
      sellAmountCryptoBaseUnit: z.string().describe('The amount to send in the base unit for that asset'),
      fromAddress: z
        .string()
        .describe(
          `The address the user is swapping from (optional). Also referred to as "sell address", and can be gotten using the getAddress() tool if not explicitly provided.`
        ),
    }),
    responseFormat: 'content_and_artifact',
  }
);
