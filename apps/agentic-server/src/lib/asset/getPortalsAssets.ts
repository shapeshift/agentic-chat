import { ASSET_NAMESPACE, fromAssetId, toAssetId } from '@shapeshiftoss/caip'
import type { Asset, Network } from '@shapeshiftoss/types'
import { chainIdToNetwork, NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { getNativeAssetReferenceByChainId } from '@shapeshiftoss/utils'
import axios from 'axios'
import { zeroAddress } from 'viem'
import { z } from 'zod'

const PORTALS_BASE_URL = process.env.PORTALS_BASE_URL
const PORTALS_API_KEY = process.env.PORTALS_API_KEY

type TokensResponse = {
  tokens: {
    name: string
    decimals: number
    symbol: string
    price: number
    address: string
    platform: string
    network: string
    image: string
  }[]
  totalItems: number
}

export const getPortalsAssetsInput = z.object({
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetIds: z.array(z.string()).optional().describe('A list of caip19 assetIds'),
  network: z.enum(NETWORKS).optional().describe('Optional network to filter tokens by'),
})

export type GetPortalsAssetsInput = z.infer<typeof getPortalsAssetsInput>
export type GetPortalsAssetsOutput = {
  assets: Asset[]
}

export const getPortalsAssets = async ({
  searchTerm,
  assetIds,
  network,
}: GetPortalsAssetsInput): Promise<GetPortalsAssetsOutput> => {
  if (!searchTerm && !assetIds) return { assets: [] }

  const { data } = await axios.get<TokensResponse>(`${PORTALS_BASE_URL}/v2/tokens`, {
    headers: { Authorization: `Bearer ${PORTALS_API_KEY}` },
    params: {
      limit: assetIds?.length ?? 5,
      networks: network,
      ...(searchTerm && { search: searchTerm }),
      ...(assetIds && {
        ids: assetIds.reduce<string[]>((acc, assetId) => {
          const { chainId, assetNamespace, assetReference } = fromAssetId(assetId)

          switch (assetNamespace) {
            case 'slip44':
              acc.push(`${chainIdToNetwork[chainId]}:${zeroAddress}`)
              break
            case 'erc20':
            case 'bep20':
              acc.push(`${chainIdToNetwork[chainId]}:${assetReference}`)
              break
          }

          return acc
        }, []),
      }),
      sortBy: 'volumeUsd1d',
      sortDirection: 'desc',
    },
    paramsSerializer: {
      indexes: null,
    },
  })

  const assets = data.tokens.reduce<Asset[]>((prev, token) => {
    const chainId = networkToChainIdMap[token.network as Network]

    if (!chainId) return prev

    const assetId = (() => {
      try {
        const assetNamespace = token.platform === 'native' ? ASSET_NAMESPACE.slip44 : ASSET_NAMESPACE.erc20
        const assetReference = token.platform === 'native' ? getNativeAssetReferenceByChainId(chainId) : token.address
        return toAssetId({ chainId, assetNamespace, assetReference })
      } catch {}
    })()

    if (!assetId) return prev

    prev.push({
      assetId,
      chainId,
      name: token.name,
      network: token.network,
      precision: token.decimals,
      price: String(token.price),
      symbol: token.symbol,
      icon: token.image || '',
    })

    return prev
  }, [])

  return { assets }
}
