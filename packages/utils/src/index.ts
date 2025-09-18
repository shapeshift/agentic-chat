import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import {
  ethChainId,
  polygonChainId,
  arbitrumChainId,
  baseChainId,
  avalancheChainId,
  optimismChainId,
  bscChainId,
  gnosisChainId,
  fromAssetId,
  arbitrumAssetId,
  avalancheAssetId,
  baseAssetId,
  bscAssetId,
  ethAssetId,
  gnosisAssetId,
  optimismAssetId,
  polygonAssetId,
  fromChainId,
  CHAIN_NAMESPACE,
  CHAIN_REFERENCE,
  ASSET_REFERENCE,
} from '@shapeshiftoss/caip'
import BigNumber from 'bignumber.js'

export * from './viem'

export const fromBaseUnit = (value: string | number | BigNumber, precision: number): string => {
  const bn = new BigNumber(value)
  return bn.dividedBy(new BigNumber(10).pow(precision)).toString()
}

export const toBaseUnit = (value: string | number | BigNumber, precision: number): string => {
  const bn = new BigNumber(value)
  return bn.multipliedBy(new BigNumber(10).pow(precision)).dp(0).toString()
}

export const getUnchainedHttpUrlEnvVar = (chainId: ChainId): string => {
  switch (chainId) {
    case ethChainId:
      return 'UNCHAINED_ETHEREUM_HTTP_URL'
    case avalancheChainId:
      return 'UNCHAINED_AVALANCHE_HTTP_URL'
    case optimismChainId:
      return 'UNCHAINED_OPTIMISM_HTTP_URL'
    case bscChainId:
      return 'UNCHAINED_BNBSMARTCHAIN_HTTP_URL'
    case polygonChainId:
      return 'UNCHAINED_POLYGON_HTTP_URL'
    case gnosisChainId:
      return 'UNCHAINED_GNOSIS_HTTP_URL'
    case arbitrumChainId:
      return 'UNCHAINED_ARBITRUM_HTTP_URL'
    case baseChainId:
      return 'UNCHAINED_BASE_HTTP_URL'
    default:
      throw new Error(`invalid chainId: ${chainId}`)
  }
}

export const isNativeEvmAsset = (assetId: AssetId): boolean => {
  switch (fromAssetId(assetId).chainId) {
    case ethChainId:
      return assetId === ethAssetId
    case avalancheChainId:
      return assetId === avalancheAssetId
    case optimismChainId:
      return assetId === optimismAssetId
    case bscChainId:
      return assetId === bscAssetId
    case polygonChainId:
      return assetId === polygonAssetId
    case gnosisChainId:
      return assetId === gnosisAssetId
    case arbitrumChainId:
      return assetId === arbitrumAssetId
    case baseChainId:
      return assetId === baseAssetId
    default:
      return false
  }
}

export const getFeeAssetIdByChainId = (chainId: ChainId): string | undefined => {
  switch (chainId) {
    case ethChainId:
      return ethAssetId
    case optimismChainId:
      return optimismAssetId
    case bscChainId:
      return bscAssetId
    case polygonChainId:
      return polygonAssetId
    case gnosisChainId:
      return gnosisAssetId
    case arbitrumChainId:
      return arbitrumAssetId
    case avalancheChainId:
      return avalancheAssetId
    case baseChainId:
      return baseAssetId
    default:
      return undefined
  }
}

export const getNativeAssetReferenceByChainId = (chainId: ChainId): string => {
  const { chainNamespace, chainReference } = fromChainId(chainId)

  switch (chainNamespace) {
    case CHAIN_NAMESPACE.Evm:
      switch (chainReference) {
        case CHAIN_REFERENCE.AvalancheCChain:
          return ASSET_REFERENCE.AvalancheC
        case CHAIN_REFERENCE.EthereumMainnet:
          return ASSET_REFERENCE.Ethereum
        case CHAIN_REFERENCE.OptimismMainnet:
          return ASSET_REFERENCE.Optimism
        case CHAIN_REFERENCE.BnbSmartChainMainnet:
          return ASSET_REFERENCE.BnbSmartChain
        case CHAIN_REFERENCE.PolygonMainnet:
          return ASSET_REFERENCE.Polygon
        case CHAIN_REFERENCE.GnosisMainnet:
          return ASSET_REFERENCE.Gnosis
        case CHAIN_REFERENCE.ArbitrumMainnet:
          return ASSET_REFERENCE.Arbitrum
        case CHAIN_REFERENCE.ArbitrumNovaMainnet:
          return ASSET_REFERENCE.ArbitrumNova
        case CHAIN_REFERENCE.BaseMainnet:
          return ASSET_REFERENCE.Base
        default:
          throw new Error(`Chain namespace ${chainNamespace} on ${chainReference} not supported.`)
      }
    default:
      throw new Error(`Chain namespace ${chainNamespace} on ${chainReference} not supported.`)
  }
}
