import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getAddress } from "viem";
import { fromBaseUnit, toBaseUnit } from "../utils/units.js";

const BEBOP_ETH_MARKER = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

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
  }) => {
    const bebopChainsMap: Record<string, string> = {
      ethereum: "ethereum",
      polygon: "polygon",
      arbitrum: "arbitrum",
      base: "base",
      avalanche: "avalanche",
      optimism: "optimism",
      bsc: "bsc",
    };

    const amountCryptoBaseUnit = toBaseUnit(input.amount, input.fromAsset.precision);

    // Convert ETH symbol to Bebop's ETH marker address
    const sellToken = getAddress(input.fromAsset.symbol.trim().toUpperCase() === 'ETH' ? BEBOP_ETH_MARKER : input.fromAsset.address);
    const buyToken = getAddress(input.toAsset.symbol.trim().toUpperCase() === 'ETH' ? BEBOP_ETH_MARKER : input.toAsset.address);

    const url = `https://api.bebop.xyz/router/${bebopChainsMap[input.chain] ?? input.chain}/v1/quote`;
    const reqParams = new URLSearchParams({
      sell_tokens: sellToken,
      buy_tokens: buyToken,
      sell_amounts: amountCryptoBaseUnit,
      taker_address: '0x0000000000000000000000000000000000000001',
      approval_type: "Standard",
      skip_validation: "true",
      gasless: "false",
    });

    const fullUrl = `${url}?${reqParams.toString()}`;
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Bebop quote: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.routes?.[0]?.quote) {
      throw new Error("No routes found in Bebop response");
    }

    const buyAmountCryptoBaseUnit = data.routes[0].quote.buyTokens[buyToken].amount.toString();
    const buyAmountCryptoPrecision = fromBaseUnit(buyAmountCryptoBaseUnit, input.toAsset.precision);

    return {
      buyAmountCryptoBaseUnit,
      buyAmountCryptoPrecision,
      buyTokens: data.routes[0].quote.buyTokens,
      sellTokens: data.routes[0].quote.sellTokens,
      originalData: data,
    };
  },
  {
    name: "bebopRate",
    description: `Fetches a swap quote from Bebop and displays it to the user.
     Returns 
    - the buy amount in both base units and human-readable precision - only the buyAmountCryptoPrecision one should be displayed to the user.
    - Also returns buyTokens and sellTokens for display purposes i.e displaying name, symbol, chain etc
    - The address should also be returned for each token with a link to the respective block explorer (assuming it's not a native token e.g ETH), so users can verify the token.
    - Also returns original data, so we can show user 
      - the market data of the buy asset (if available) 
      - the slippage (if available) 
      - and the price impact (if available)

    Use emojis for each bullet point and format things nicely.`,
    schema: z.object({
      chain: z.string().describe("Chain name, e.g. ethereum, polygon, etc."),
      fromAsset: z.object({
        address: z.string(),
        precision: z.number(),
        name: z.string(),
        symbol: z.string(),
      }).describe("Asset to sell"),
      toAsset: z.object({
        address: z.string(),
        precision: z.number(),
        name: z.string(),
        symbol: z.string(),
      }).describe("Asset to buy"),
      amount: z.string().describe("Amount in human format, e.g. 1 for 1 ETH"),
    })
  }
); 