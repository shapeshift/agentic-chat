import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { ASSET_NAMESPACE, fromAssetId, toAssetId } from '@shapeshiftoss/caip'
import { chainIdToNetwork, networkToChainIdMap } from '@shapeshiftoss/types'
import type { Asset, Network } from '@shapeshiftoss/types'
import axios from 'axios'

import { isSolanaChain, isSuiChain } from '../../../utils/chains/helpers'

import { COINGECKO_API_KEY, API_TIMEOUT, networkToOnchainNetwork } from './constants'

type TokensResponse = {
  data: {
    id: string
    type: string
    attributes: {
      address: string
      name: string
      symbol: string
      decimals: number
      price_usd: string
      image_url: string
    }
  }[]
}

/**
 * Validates that all asset IDs belong to the same chain.
 * @throws Error if assets are from different chains
 * @returns The shared chain ID
 */
function validateSameChain(assetIds: AssetId[]): ChainId {
  if (assetIds.length === 0) {
    throw new Error('No asset IDs provided')
  }

  const chainIds = new Set(assetIds.map(assetId => fromAssetId(assetId).chainId))

  if (chainIds.size > 1) {
    throw new Error(
      `All assets must be from the same chain. Found assets from ${chainIds.size} different chains: ${Array.from(chainIds).join(', ')}`
    )
  }

  return assetIds[0] ? fromAssetId(assetIds[0]).chainId : ''
}

// Converts token asset IDs to contract addresses for CoinGecko API
// Native assets (slip44) should be handled by getNativeAssetWithPrice instead
function assetIdToCoinGeckoAddress(assetId: AssetId): string | null {
  const { assetNamespace, assetReference } = fromAssetId(assetId)

  switch (assetNamespace) {
    case ASSET_NAMESPACE.erc20:
    case ASSET_NAMESPACE.bep20:
    case ASSET_NAMESPACE.splToken:
    case ASSET_NAMESPACE.suiToken:
      return assetReference

    default:
      return null
  }
}

// Transforms CoinGecko token response to Asset format (tokens only, not native assets)
function transformCoinGeckoToken(token: TokensResponse['data'][0], network: Network): Asset | null {
  const chainId = networkToChainIdMap[network]

  if (!chainId) {
    return null
  }

  try {
    const assetNamespace = (() => {
      if (isSolanaChain(chainId)) return ASSET_NAMESPACE.splToken
      if (isSuiChain(chainId)) return ASSET_NAMESPACE.suiToken
      return ASSET_NAMESPACE.erc20
    })()

    const assetId = toAssetId({ chainId, assetNamespace, assetReference: token.attributes.address })

    return {
      assetId,
      chainId,
      name: token.attributes.name,
      network,
      precision: token.attributes.decimals,
      price: token.attributes.price_usd,
      symbol: token.attributes.symbol,
      // icon: token.attributes.image_url,
    }
  } catch {
    return null
  }
}

export const getCoingeckoAssetsByAssetIds = async ({
  assetIds,
}: {
  assetIds: AssetId[]
}): Promise<{ assets: Asset[] }> => {
  // Validate all assets are from the same chain
  const chainId = validateSameChain(assetIds)
  const network = chainIdToNetwork[chainId]

  if (!network) {
    throw new Error(`No network mapping found for chain ID: ${chainId}`)
  }

  // Extract CoinGecko-compatible addresses
  const addresses = assetIds.map(assetIdToCoinGeckoAddress).filter((address): address is string => address !== null)

  if (addresses.length === 0) {
    return { assets: [] }
  }

  // Fetch token data from CoinGecko
  const onchainNetworkId = networkToOnchainNetwork[network]

  if (!onchainNetworkId) {
    throw new Error(`No onchain network mapping found for network: ${network}`)
  }

  const { data } = await axios.get<TokensResponse>(
    `https://pro-api.coingecko.com/api/v3/onchain/networks/${onchainNetworkId}/tokens/multi/${addresses.join(',')}`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      timeout: API_TIMEOUT,
    }
  )

  // Transform response to Asset format
  const assets = data.data
    .map(token => transformCoinGeckoToken(token, network))
    .filter((asset): asset is Asset => asset !== null)

  return { assets }
}
