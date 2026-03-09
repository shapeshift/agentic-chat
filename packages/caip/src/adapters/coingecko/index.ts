import invertBy from 'lodash/invertBy.js'

import { fromAssetId } from '../../assetId.js'
import { fromChainId, toChainId } from '../../chainId.js'
import type { AssetId, ChainId } from '../../constants.js'
import {
  arbitrumChainId,
  arbitrumNovaChainId,
  avalancheChainId,
  baseChainId,
  bscChainId,
  CHAIN_NAMESPACE,
  CHAIN_REFERENCE,
  cosmosChainId,
  ethChainId,
  gnosisChainId,
  mayachainChainId,
  optimismChainId,
  polygonChainId,
  solanaChainId,
  thorchainChainId,
} from '../../constants.js'

const COINGECKO_BASE =
  'https://raw.githubusercontent.com/shapeshift/web/develop/packages/caip/src/adapters/coingecko/generated'

const COINGECKO_CHAINS = [
  'bip122_000000000019d6689c085ae165831e93',
  'bip122_000000000000000000651ef99cb9fcbe',
  'bip122_00000000001a91e3dace36e2be3bf030',
  'bip122_12a765e31ffd4059bada1e25190f6e98',
  'cosmos_cosmoshub-4',
  'cosmos_mayachain-mainnet-v1',
  'cosmos_thorchain-1',
  'eip155_1',
  'eip155_10',
  'eip155_100',
  'eip155_137',
  'eip155_42161',
  'eip155_43114',
  'eip155_56',
  'eip155_8453',
  'solana_5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
]

// https://api.coingecko.com/api/v3/asset_platforms
export enum CoingeckoAssetPlatform {
  Ethereum = 'ethereum',
  Cosmos = 'cosmos',
  Polygon = 'polygon-pos',
  Gnosis = 'xdai',
  Avalanche = 'avalanche',
  Thorchain = 'thorchain',
  Mayachain = 'cacao',
  Optimism = 'optimistic-ethereum',
  BnbSmartChain = 'binance-smart-chain',
  Arbitrum = 'arbitrum-one',
  ArbitrumNova = 'arbitrum-nova',
  Base = 'base',
  Solana = 'solana',
}

type CoinGeckoId = string

export const coingeckoBaseUrl = 'https://api.proxy.shapeshift.com/api/v1/markets'
export const coingeckoUrl = `${coingeckoBaseUrl}/coins/list?include_platform=true`

let generatedAssetIdToCoingeckoMap: Record<AssetId, CoinGeckoId> = {}
let generatedCoingeckoToAssetIdsMap: Record<CoinGeckoId, AssetId[]> = {}

export async function initializeCoinGeckoAdapters(): Promise<void> {
  const results = await Promise.allSettled(
    COINGECKO_CHAINS.map(async chain => {
      const response = await fetch(`${COINGECKO_BASE}/${chain}/adapter.json`)
      if (!response.ok) throw new Error(`CoinGecko adapter fetch failed for ${chain}: HTTP ${response.status}`)
      return response.json() as Promise<Record<AssetId, string>>
    })
  )

  const adapters: Record<AssetId, string>[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!
    if (result.status === 'fulfilled') {
      adapters.push(result.value)
    } else {
      console.warn(`[CoinGecko] Skipping ${COINGECKO_CHAINS[i]}: ${result.reason}`)
    }
  }

  if (adapters.length === 0) throw new Error('All CoinGecko adapter fetches failed')

  generatedAssetIdToCoingeckoMap = Object.assign({}, ...adapters)
  generatedCoingeckoToAssetIdsMap = invertBy(generatedAssetIdToCoingeckoMap)
}

export const coingeckoToAssetIds = (id: CoinGeckoId): AssetId[] => generatedCoingeckoToAssetIdsMap[id] || []

export const assetIdToCoingecko = (assetId: AssetId): CoinGeckoId | undefined => generatedAssetIdToCoingeckoMap[assetId]

// https://www.coingecko.com/en/api/documentation - See asset_platforms
export const chainIdToCoingeckoAssetPlatform = (chainId: ChainId): string => {
  const { chainNamespace, chainReference } = fromChainId(chainId)
  switch (chainNamespace) {
    case CHAIN_NAMESPACE.Evm:
      switch (chainReference) {
        case CHAIN_REFERENCE.EthereumMainnet:
          return CoingeckoAssetPlatform.Ethereum
        case CHAIN_REFERENCE.AvalancheCChain:
          return CoingeckoAssetPlatform.Avalanche
        case CHAIN_REFERENCE.OptimismMainnet:
          return CoingeckoAssetPlatform.Optimism
        case CHAIN_REFERENCE.BnbSmartChainMainnet:
          return CoingeckoAssetPlatform.BnbSmartChain
        case CHAIN_REFERENCE.PolygonMainnet:
          return CoingeckoAssetPlatform.Polygon
        case CHAIN_REFERENCE.GnosisMainnet:
          return CoingeckoAssetPlatform.Gnosis
        case CHAIN_REFERENCE.ArbitrumMainnet:
          return CoingeckoAssetPlatform.Arbitrum
        case CHAIN_REFERENCE.ArbitrumNovaMainnet:
          return CoingeckoAssetPlatform.ArbitrumNova
        case CHAIN_REFERENCE.BaseMainnet:
          return CoingeckoAssetPlatform.Base
        default:
          throw new Error(`chainNamespace ${chainNamespace}, chainReference ${chainReference} not supported.`)
      }
    case CHAIN_NAMESPACE.CosmosSdk:
      switch (chainReference) {
        case CHAIN_REFERENCE.CosmosHubMainnet:
          return CoingeckoAssetPlatform.Cosmos
        case CHAIN_REFERENCE.ThorchainMainnet:
          return CoingeckoAssetPlatform.Thorchain
        case CHAIN_REFERENCE.MayachainMainnet:
          return CoingeckoAssetPlatform.Mayachain
        default:
          throw new Error(`chainNamespace ${chainNamespace}, chainReference ${chainReference} not supported.`)
      }
    case CHAIN_NAMESPACE.Solana:
      switch (chainReference) {
        case CHAIN_REFERENCE.SolanaMainnet:
          return CoingeckoAssetPlatform.Solana
        default:
          throw new Error(`chainNamespace ${chainNamespace}, chainReference ${chainReference} not supported.`)
      }
    // No valid asset platform: https://api.coingecko.com/api/v3/asset_platforms
    case CHAIN_NAMESPACE.Utxo:
    default:
      throw new Error(`chainNamespace ${chainNamespace} not supported.`)
  }
}

export const coingeckoAssetPlatformToChainId = (platform: CoingeckoAssetPlatform): ChainId | undefined => {
  switch (platform) {
    case CoingeckoAssetPlatform.Ethereum:
      return ethChainId
    case CoingeckoAssetPlatform.Avalanche:
      return avalancheChainId
    case CoingeckoAssetPlatform.Optimism:
      return optimismChainId
    case CoingeckoAssetPlatform.BnbSmartChain:
      return bscChainId
    case CoingeckoAssetPlatform.Polygon:
      return polygonChainId
    case CoingeckoAssetPlatform.Gnosis:
      return gnosisChainId
    case CoingeckoAssetPlatform.Arbitrum:
      return arbitrumChainId
    case CoingeckoAssetPlatform.ArbitrumNova:
      return arbitrumNovaChainId
    case CoingeckoAssetPlatform.Base:
      return baseChainId
    case CoingeckoAssetPlatform.Cosmos:
      return cosmosChainId
    case CoingeckoAssetPlatform.Thorchain:
      return thorchainChainId
    case CoingeckoAssetPlatform.Mayachain:
      return mayachainChainId
    case CoingeckoAssetPlatform.Solana:
      return solanaChainId
    default:
      return undefined
  }
}

export const makeCoingeckoAssetUrl = (assetId: AssetId): string | undefined => {
  const id = assetIdToCoingecko(assetId)
  if (!id) return

  const { chainNamespace, chainReference, assetNamespace, assetReference } = fromAssetId(assetId)

  if (assetNamespace === 'erc20') {
    const assetPlatform = chainIdToCoingeckoAssetPlatform(toChainId({ chainNamespace, chainReference }))

    return `${coingeckoBaseUrl}/coins/${assetPlatform}/contract/${assetReference}`
  }

  return `${coingeckoBaseUrl}/coins/${id}`
}
