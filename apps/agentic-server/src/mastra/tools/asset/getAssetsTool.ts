import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { asset, chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import z from 'zod'

import { isCardanoChain, isCosmosChain, isTronChain, isUtxoChain } from '../../../utils/chains/helpers'

import { coingeckoIdToNativeNetworks } from './coingecko/constants'
import { getCoingeckoAssetsByAssetIds } from './coingecko/getCoingeckoAssetsByAssetIds'
import { getCoingeckoAssetsBySearchTerm } from './coingecko/getCoingeckoAssetsBySearchTerm'
import { getNativeAssetWithPrice } from './coingecko/getNativeAssetWithPrice'
import { getPortalsAssets } from './getPortalsAssetsTool'

const getAssetsInput = z.object({
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetIds: z.array(z.string()).optional().describe('A list of caip19 assetIds'),
  network: z.enum(NETWORKS).optional().describe('Optional network to filter tokens by'),
})

export const getAssetsOutput = z.object({
  assets: z.array(asset),
})

export type GetAssetsInput = z.infer<typeof getAssetsInput>
export type GetAssetsOutput = z.infer<typeof getAssetsOutput>

export const getAssetsTool = createTool({
  id: 'getAssets',
  description:
    'Find crypto assets by name/symbol with market data and prices. Supports 18 networks including EVM chains (Ethereum, Arbitrum, etc), Solana, Sui, Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, and Cardano.',
  inputSchema: getAssetsInput,
  outputSchema: getAssetsOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger()

    logger?.info('getAssetsTool', { context })

    const { searchTerm, assetIds, network } = context

    let assets: Asset[] = []

    // Handle native-only chains: UTXO (Bitcoin, Litecoin, Dogecoin, Bitcoin Cash),
    // Cosmos SDK (Cosmos, THORChain), Tron, and Cardano
    // These chains only have native assets (no tokens/contracts support for now)
    if (assetIds) {
      const firstAssetId = assetIds[0]
      if (firstAssetId) {
        const { chainId } = fromAssetId(firstAssetId)
        if (isUtxoChain(chainId) || isCosmosChain(chainId) || isTronChain(chainId) || isCardanoChain(chainId)) {
          const nativeOnlyNetwork = chainIdToNetwork[chainId]
          const coinId = Object.entries(coingeckoIdToNativeNetworks).find(([, networks]) =>
            networks.includes(nativeOnlyNetwork)
          )?.[0]

          if (coinId) {
            try {
              const asset = await getNativeAssetWithPrice(coinId, nativeOnlyNetwork)
              return { assets: [asset] }
            } catch (error) {
              logger?.debug('Native-only chain fetch failed', { error, network: nativeOnlyNetwork, coinId })
              return { assets: [] }
            }
          }
        }
      }
    }

    try {
      // Try CoinGecko first (primary data source)
      let coingeckoResult
      if (searchTerm) {
        coingeckoResult = await getCoingeckoAssetsBySearchTerm({ searchTerm, network })
      } else if (assetIds) {
        coingeckoResult = await getCoingeckoAssetsByAssetIds({ assetIds })
      }

      if (coingeckoResult && coingeckoResult.assets.length > 0) {
        assets = coingeckoResult.assets
      }
    } catch (error) {
      logger?.debug('CoinGecko fetch failed, trying Portals fallback', { error, searchTerm, assetIds, network })
    }

    if (assets.length === 0) {
      try {
        const portalsResult = await getPortalsAssets({
          searchTerm,
          assetIds,
          network,
        })

        if (portalsResult.assets.length > 0) {
          assets = portalsResult.assets
        }
      } catch (error) {
        logger?.debug('Portals fetch also failed, no assets found', { error, searchTerm, assetIds, network })
      }
    }

    // If we have multiple assets from search, take the first (most relevant) result
    if (!assetIds && searchTerm && assets.length > 1) {
      assets = [assets[0]]
    }

    return { assets }
  },
})
