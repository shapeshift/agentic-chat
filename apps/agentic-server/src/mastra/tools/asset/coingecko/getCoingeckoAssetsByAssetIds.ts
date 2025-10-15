import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { ASSET_NAMESPACE, fromAssetId, toAssetId } from '@shapeshiftoss/caip'
import { chainIdToNetwork, networkToChainIdMap } from '@shapeshiftoss/types'
import type { Asset, Network } from '@shapeshiftoss/types'
import { getNativeAssetReferenceByChainId } from '@shapeshiftoss/utils'
import axios from 'axios'
import { zeroAddress } from 'viem'

import { isSolanaChain } from '../../../../utils/chains/helpers'

import { COINGECKO_API_KEY, API_TIMEOUT, networkToOnchainNetwork, networkToNativeAsset } from './constants'
import { getNativeAssetAddress } from './helpers'

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

/**
 * Converts a CAIP-19 asset ID to CoinGecko's expected address format.
 *
 * CoinGecko expects:
 * - EVM native assets: 0x0000000000000000000000000000000000000000 (zero address)
 * - EVM tokens: contract address (e.g., 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
 * - Solana native: So11111111111111111111111111111111111111112 (NATIVE_MINT/wrapped SOL)
 * - Solana tokens: token mint address (e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
 *
 * @returns Address string for CoinGecko API, or null if asset should be excluded
 */
function assetIdToCoinGeckoAddress(assetId: AssetId): string | null {
  const { assetNamespace, assetReference, chainId } = fromAssetId(assetId)

  switch (assetNamespace) {
    case ASSET_NAMESPACE.slip44:
      // Native assets: use on-chain address format
      return getNativeAssetAddress(chainId)

    case ASSET_NAMESPACE.erc20:
    case ASSET_NAMESPACE.bep20:
    case ASSET_NAMESPACE.splToken:
      return assetReference

    default:
      return null
  }
}

/**
 * Transforms a CoinGecko token response into our Asset format.
 */
function transformCoinGeckoToken(token: TokensResponse['data'][0], network: Network): Asset | null {
  const chainId = networkToChainIdMap[network]

  if (!chainId) {
    return null
  }

  try {
    const isNativeAsset = token.attributes.address === zeroAddress
    const nativeAssetAddress = getNativeAssetAddress(chainId)
    const isNativeAssetByCoinGeckoAddress = token.attributes.address === nativeAssetAddress

    let assetId: AssetId
    let name: string
    let symbol: string

    if (isNativeAsset || isNativeAssetByCoinGeckoAddress) {
      const assetReference = getNativeAssetReferenceByChainId(chainId)
      assetId = toAssetId({ chainId, assetNamespace: ASSET_NAMESPACE.slip44, assetReference })

      // Use our native asset definitions instead of CoinGecko's naming
      const nativeAsset = networkToNativeAsset[network]
      name = nativeAsset.name
      symbol = nativeAsset.symbol
    } else {
      const assetNamespace = isSolanaChain(chainId) ? ASSET_NAMESPACE.splToken : ASSET_NAMESPACE.erc20
      assetId = toAssetId({ chainId, assetNamespace, assetReference: token.attributes.address })
      name = token.attributes.name
      symbol = token.attributes.symbol
    }

    return {
      assetId,
      chainId,
      name,
      network,
      precision: token.attributes.decimals,
      price: token.attributes.price_usd,
      symbol,
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
