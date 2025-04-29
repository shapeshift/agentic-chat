import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import qs from "qs";

export const tokensSearch = tool(
  async (input: { search: string; network?: string; limit?: number }) => {
    const PORTALS_BASE_URL = process.env.PORTALS_BASE_URL;
    const PORTALS_API_KEY = process.env.PORTALS_API_KEY;

    if (!PORTALS_BASE_URL || !PORTALS_API_KEY) {
      throw new Error("PORTALS_BASE_URL and PORTALS_API_KEY must be set in environment variables.");
    }

    const tokensUrl = `${PORTALS_BASE_URL}/v2/tokens`;
    const params = {
      search: input.search,
      networks: input.network ? [input.network] : [],
      platforms: ["basic", "native"],
      sortBy: "volumeUsd7d",
      limit: input.limit || 10,
      sortDirection: "desc",
    };

    const { data } = await axios.get(tokensUrl, {
      paramsSerializer: params => qs.stringify(params, { arrayFormat: 'repeat' }),
      headers: {
        Authorization: `Bearer ${PORTALS_API_KEY}`,
      },
      params,
    });

    return {
      tokens: data.tokens?.map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        chainId: token.chainId,
        logoURI: token.logoURI,
        volumeUsd7d: token.volumeUsd7d,
        priceUsd: token.priceUsd,
      })) ?? [],
      total: data.total,
    };
  },
  {
    name: "tokensSearch",
    description: `Search for tokens using the Portals API /v2/tokens endpoint. Returns tokens matching the search term, sorted by 7-day USD volume. 
    Uses the Portals API key and base URL from environment variables. 
    User *may* mention a network which should be parsed as network parameter, or it may be omitted, in which case it will search across all networks (no network param)`,
    schema: z.object({
      search: z.string().describe("Search term for the token, e.g. symbol, name, or address"),
      network: z.string().optional().describe(`Network to search on, i.e any of:
      - avalanche
      - ethereum
      - polygon
      - bsc
      - optimism
      - arbitrum
      - gnosis
      - base

      Use text proximity i.e if the user says on Binance Smart Chain, they mean bsc, if they say Avax, they mean avalanche, etc.
      `),
      limit: z.number().min(1).max(50).default(10).optional().describe("Maximum number of results to return (default 10, max 50)"),
    })
  }
); 