import { toAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/utils'

import { UNIFIED_NETWORKS } from '../constants'
import type { UnifiedNetwork } from '../constants'

import { NULL_ADDRESS, ETH_SLIP44, ETH_PRECISION, UNIFIED_TO_SEARCH_PLATFORM } from './constants'
import type { TokensResponse, CoinResponse } from './types'

// Utility functions
export const tokenResponseToAsset = (
  token: TokensResponse['data'][0],
  unifiedNetwork: UnifiedNetwork
): Asset | null => {
  if (!token.attributes?.address || !token.attributes?.symbol || !token.attributes?.name) {
    console.log(`Invalid token data: missing required fields for ${token.id}`)
    return null
  }

  const chainId = networkToChainIdMap[unifiedNetwork]
  if (!chainId) {
    console.log(`No chainId found for network ${unifiedNetwork}`)
    return null
  }

  const assetId = toAssetId({
    chainId,
    assetNamespace: 'erc20',
    assetReference: token.attributes.address,
  })

  return {
    assetId,
    chainId,
    symbol: token.attributes.symbol.toUpperCase(),
    name: token.attributes.name,
    network: unifiedNetwork,
    precision: token.attributes.decimals,
    price: token.attributes.price_usd.toString(),
    icon: token.attributes.image_url,
    availableNetworks: [unifiedNetwork], // For onchain API, we only know about this network
  }
}

export const createAsset = (
  coin: CoinResponse,
  options: {
    platform?: { contract_address: string; decimal_place: number }
    unifiedNetwork: UnifiedNetwork
    isNativeETH?: boolean
  }
): Asset | null => {
  const { platform, unifiedNetwork, isNativeETH = false } = options

  if (isNativeETH && coin.id !== 'ethereum') return null

  const chainId = networkToChainIdMap[unifiedNetwork]
  if (!chainId) return null

  const assetId = toAssetId({
    chainId,
    assetNamespace: isNativeETH ? 'slip44' : 'erc20',
    assetReference: isNativeETH ? ETH_SLIP44 : platform!.contract_address,
  })

  return {
    assetId,
    chainId,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    network: unifiedNetwork,
    precision: isNativeETH ? ETH_PRECISION : platform!.decimal_place,
    price: coin.market_data.current_price.usd?.toString() || '0',
    icon: coin.image.large,
    availableNetworks: getAvailableNetworks(coin),
  }
}

// Legacy function names for backward compatibility
export const createERC20Asset = (
  coin: CoinResponse,
  platform: { contract_address: string; decimal_place: number },
  unifiedNetwork: UnifiedNetwork
): Asset | null => createAsset(coin, { platform, unifiedNetwork })

export const createNativeETHAsset = (coin: CoinResponse): Asset | null =>
  createAsset(coin, { unifiedNetwork: 'ethereum', isNativeETH: true })

export const coinResponseToAsset = (coin: CoinResponse, requestedNetwork?: UnifiedNetwork): Asset | null => {
  if (!coin.id || !coin.symbol || !coin.name) {
    return null
  }

  // Try native ETH first if applicable
  if (coin.id === 'ethereum' && (!requestedNetwork || requestedNetwork === 'ethereum')) {
    return createNativeETHAsset(coin)
  }

  // If network is specified, look for that platform directly
  if (requestedNetwork) {
    const platformId = UNIFIED_TO_SEARCH_PLATFORM[requestedNetwork]
    const platform = coin.detail_platforms[platformId]

    if (platform?.contract_address && platform.contract_address !== NULL_ADDRESS) {
      return createERC20Asset(coin, platform, requestedNetwork)
    }
    return null
  }

  // No network specified - try networks in our preferred order
  for (const unifiedNetwork of UNIFIED_NETWORKS) {
    const platformId = UNIFIED_TO_SEARCH_PLATFORM[unifiedNetwork]
    const platform = coin.detail_platforms[platformId]

    if (platform?.contract_address && platform.contract_address !== NULL_ADDRESS) {
      return createERC20Asset(coin, platform, unifiedNetwork)
    }
  }

  return null
}

export const getAvailableNetworks = (coin: CoinResponse): string[] => {
  const networks: string[] = []

  // Check each of our supported networks
  for (const unifiedNetwork of UNIFIED_NETWORKS) {
    const platformId = UNIFIED_TO_SEARCH_PLATFORM[unifiedNetwork]
    const platform = coin.detail_platforms[platformId]

    if (platform?.contract_address && platform.contract_address !== NULL_ADDRESS) {
      networks.push(unifiedNetwork)
    }
  }

  // Special case for ethereum native asset
  if (coin.id === 'ethereum' && !networks.includes('ethereum')) {
    networks.push('ethereum')
  }

  return networks
}
