import qs from 'qs';
import axios from 'axios';
import { PortalsResponse, Asset } from '@agentic-chat/types';
import { ASSET_NAMESPACE, bscChainId, toAssetId } from '@shapeshiftoss/caip';
import { AssetsStore } from '../stores/assets';
import { networkToChainIdMap } from '../lib/utils';
import z from 'zod';

const env = import.meta?.env ? import.meta.env : process.env;
const PORTALS_BASE_URL = env.VITE_PORTALS_BASE_URL;
const PORTALS_API_KEY = env.VITE_PORTALS_API_KEY;

export const searchTokensParams = z.object({
  searchTerm: z
    .string()
    .describe('The search term to find tokens by name or symbol'),
  network: z
    .string()
    .optional()
    .describe(
      'Optional network to filter tokens by (e.g., ethereum, arbitrum)'
    ),
});

export type SearchTokensParams = z.infer<typeof searchTokensParams>;
export type SearchTokensResult = {
  assets: Asset[];
  total: number;
};

export const searchTokens = async ({
  searchTerm,
  network,
  assetsStore,
}: SearchTokensParams & {
  assetsStore: AssetsStore;
}) => {
  const tokensUrl = `${PORTALS_BASE_URL}/v2/tokens`;
  const params = {
    search: searchTerm,
    networks: network ? [network] : [],
    platforms: ['basic', 'native'],
    sortBy: 'volumeUsd7d',
    limit: 10,
    sortDirection: 'desc',
  };

  const { data } = await axios.get<PortalsResponse>(tokensUrl, {
    paramsSerializer: (params) =>
      qs.stringify(params, { arrayFormat: 'repeat' }),
    headers: {
      Authorization: `Bearer ${PORTALS_API_KEY}`,
    },
    params,
  });

  // Convert PortalsToken to Asset types
  const assets: Asset[] =
    data.tokens?.map((token) => {
      const network = token.network;
      const chainId = networkToChainIdMap[network];

      const assetId = toAssetId({
        chainId,
        assetNamespace:
          chainId === bscChainId
            ? ASSET_NAMESPACE.bep20
            : ASSET_NAMESPACE.erc20,
        assetReference: token.address,
      });

      return {
        assetId,
        chainId,
        symbol: token.symbol,
        name: token.name,
        precision: token.decimals,
        icon: token.image,
      };
    }) ?? [];

  // Upsert assets to store
  assetsStore.upsert(assets);

  return {
    assets,
    total: data.total,
  };
};
