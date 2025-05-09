import { fromBaseUnit, toBaseUnit } from '@agentic-chat/utils';
import { tool } from '@langchain/core/tools';
import { getAddress } from 'viem';
import { z } from 'zod';
import { Asset, BebopResponse } from './types';
import {
  ASSET_NAMESPACE,
  CHAIN_NAMESPACE,
  ChainReference,
  toAssetId,
  toChainId,
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

    const quote = data.routes[0].quote

    const buyAmountCryptoBaseUnit =
      quote.buyTokens[buyTokenAddress].amount.toString();
    const buyAmountCryptoPrecision = fromBaseUnit(
      buyAmountCryptoBaseUnit,
      input.toAsset.precision
    );

    const sellToken = Object.values(quote.sellTokens)[0];
    const buyToken = Object.values(quote.buyTokens)[0];
    const chainId = toChainId({
      chainNamespace: CHAIN_NAMESPACE.Evm,
      chainReference: quote.chainId.toString() as ChainReference,
    });
    const sellAsset: Asset = {
      name: sellToken.name ?? '',
      symbol: sellToken.symbol,
      precision: sellToken.decimals,
      chainId,
      assetId: toAssetId({
        chainId,
        assetNamespace: ASSET_NAMESPACE.erc20,
        assetReference: sellToken.address ?? '',
      }),
    };
    const buyAsset: Asset = {
      name: buyToken.name ?? '',
      symbol: buyToken.symbol,
      precision: buyToken.decimals,
      chainId,
      assetId: toAssetId({
        chainId,
        assetNamespace: ASSET_NAMESPACE.erc20,
        assetReference: buyToken.address ?? '',
      }),
    };

    const content = {
      sellAmountCryptoBaseUnit: sellAmountCryptoBaseUnit,
      sellAmountCryptoPrecision: input.amount,
      approvalTarget: quote.approvalTarget,
      sellAsset,
      buyAsset,
      txData: quote.tx,
      buyAmountCryptoBaseUnit,
      buyAmountCryptoPrecision,
      buyTokens: quote.buyTokens,
      sellTokens: quote.sellTokens,
      quote: quote,
    };

    return [content, content];
  },
  {
    name: 'bebopRate',
    description: `Fetches a swap rate from Bebop and displays it to the user.

Returns an object with the following fields (for internal use, unless otherwise specified):
- sellAmountCryptoBaseUnit: The sell amount in base units (raw integer, e.g., 1000000 for 1 USDC with 6 decimals). **Internal use only.**
- sellAmountCryptoPrecision: The sell amount in human-readable precision (e.g., 1 for 1 USDC). **Display this to the user.**
- buyAmountCryptoBaseUnit: The buy amount in base units (raw integer, e.g., 32413 for USDC). **Internal use only.**
- buyAmountCryptoPrecision: The buy amount in human-readable precision (e.g., 0.032413 for 0.032413 USDC). **Display this to the user.**
- buyAmount: Alias for buyAmountCryptoPrecision. **Display this to the user.**
- feeData: Fee data for the quote. **Internal use only.**
- rate: The calculated rate for the swap. **Internal use only.**
- swapperName: The name of the swapper (e.g., 'Bebop'). **Internal use only.**
- buyAsset: Object describing the buy asset (assetId, chainId, symbol, name, precision). **Internal use only.**
- sellAsset: Object describing the sell asset (assetId, chainId, symbol, name, precision). **Internal use only.**
- allowanceTarget: The address to approve for token transfers. **Internal use only.**
- bebopOriginalQuote: The original Bebop quote object. **Internal use only.**

**Instructions for LLM:**
- Only display the precision values (buyAmountCryptoPrecision, sellAmountCryptoPrecision, or buyAmount) to the user.
- Do not display base unit values, feeData, rate, swapperName, asset objects, allowanceTarget, or bebopOriginalQuote to the user unless specifically asked for technical details.
- If the user requests technical details, you may show base unit values and other internal fields.
- Always clarify the number of decimals for each token if needed.
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
        .optional()
        .describe(
          'The address the user is swapping from (optional). Also referred to as "sell address". If the user did not provide it, they will be prompted to do so after getting a rate, before continuing.'
        ),
    }),
    responseFormat: 'content_and_artifact',
  }
);
