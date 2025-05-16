import { fromBaseUnit, toBaseUnit } from '@agentic-chat/utils';
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
    amount: string;
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

    const sellAmountCryptoBaseUnit = toBaseUnit(
      input.amount,
      input.fromAsset.precision
    );

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
    const buyAmountCryptoPrecision = fromBaseUnit(
      buyAmountCryptoBaseUnit,
      input.toAsset.precision
    );

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
      sellAmountCryptoPrecision: input.amount,
      buyAmountCryptoPrecision,
      sellAsset,
      buyAsset,
      txData: quote.tx,
    };

    const artifacts = {
      swapperName: 'bebop',
      sellAmountCryptoBaseUnit,
      sellAmountCryptoPrecision: input.amount,
      buyAmountCryptoBaseUnit,
      buyAmountCryptoPrecision,
      approvalTarget: quote.approvalTarget,
      sellAsset,
      buyAsset,
      txData: quote.tx,
      buyTokens: quote.buyTokens,
      sellTokens: quote.sellTokens,
      quote: quote,
    };

    return [content, artifacts];
  },
  {
    name: 'bebopRate',
    description: `Fetches a swap rate from Bebop and displays it to the user.

Returns an object with the following fields, for display to the user
- sellAmountCryptoPrecision: The sell amount in human-readable precision (e.g., 1 for 1 USDC). **Display this to the user.**
- buyAmountCryptoPrecision: The buy amount in human-readable precision (e.g., 0.032413 for 0.032413 USDC). **Display this to the user.**
- swapperName: The name of the swapper (e.g., 'Bebop'). **Internal use only.**
- buyAsset: Object describing the buy asset (assetId, chainId, symbol, name, precision). **Use this as necessary**
- sellAsset: Object describing the sell asset (assetId, chainId, symbol, name, precision). **Use this as necessary**

**Instructions for LLM:**
- Only display the precision values (buyAmountCryptoPrecision, sellAmountCryptoPrecision, or buyAmount) to the user.
- Do not display base unit values, feeData, rate, swapperName, asset objects, allowanceTarget, or quote to the user unless specifically asked for technical details.
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
      amount: z.string().describe('Amount in human format, e.g. 1 for 1 ETH'),
      fromAddress: z
        .string()
        .describe(
          `The address the user is swapping from (optional). Also referred to as "sell address", and can be gotten using the getAddress() tool if not explicitly provided.`
        ),
    }),
    responseFormat: 'content_and_artifact',
  }
);
