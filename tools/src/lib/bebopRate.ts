import { fromBaseUnit, toBaseUnit } from '@agentic-chat/utils';
import { tool } from '@langchain/core/tools';
import { getAddress } from 'viem';
import { z } from 'zod';
import { BebopResponse } from './types';

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

    const amountCryptoBaseUnit = toBaseUnit(
      input.amount,
      input.fromAsset.precision
    );

    // Convert ETH symbol to Bebop's ETH marker address
    const sellToken = getAddress(
      input.fromAsset.symbol.trim().toUpperCase() === 'ETH'
        ? BEBOP_ETH_MARKER
        : input.fromAsset.address
    );
    const buyToken = getAddress(
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
      sell_tokens: sellToken,
      buy_tokens: buyToken,
      sell_amounts: amountCryptoBaseUnit,
      taker_address: takerAddress,
      approval_type: 'Standard',
      skip_validation: 'true',
      gasless: 'false',
      source: 'shapeshift'
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

    const buyAmountCryptoBaseUnit =
      data.routes[0].quote.buyTokens[buyToken].amount.toString();
    const buyAmountCryptoPrecision = fromBaseUnit(
      buyAmountCryptoBaseUnit,
      input.toAsset.precision
    );

    const content = {
      buyAmountCryptoBaseUnit,
      buyAmountCryptoPrecision,
      buyTokens: data.routes[0].quote.buyTokens,
      sellTokens: data.routes[0].quote.sellTokens,
      quote: data.routes?.[0]?.quote,
    };

    return [content, content];
  },
  {
    name: 'bebopRate',
    description: `Fetches a swap rate from Bebop and displays it to the user.

Returns:
- The buy amount in both base units (raw integer, e.g., 32413 for USDC) and human-readable precision (e.g., 0.032413 USDC for 6 decimals).
- **Always display the precision value to the user (e.g., 0.32413 USDC, 1.12345678 ETH).**
- The base unit value is for contract/transaction use only (e.g., 32413000 for USDC with 6 decimals, 1000000000000000000 for 1 ETH with 18 decimals).
- Example: 1 USDC = 1000000 base units (6 decimals), 1 ETH = 1000000000000000000 base units (18 decimals).
- Returns buyTokens and sellTokens for display purposes (name, symbol, chain, etc).
- The address should also be returned for each token with a link to the respective block explorer (if not a native token).
- Also returns original data, so we can show user:
  - the market data of the buy asset (if available)
  - the slippage (if available)
  - and the price impact (if available)

**Instructions**
- When presenting amounts to the user, always use the precision value (e.g., 0.123456 USDC or 0.1234567812345678 ETH).
- Only show the base unit value if the user requests technical details or for contract/transaction purposes.
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
