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
      return 'VITE_UNCHAINED_ETHEREUM_HTTP_URL'
    case avalancheChainId:
      return 'VITE_UNCHAINED_AVALANCHE_HTTP_URL'
    case optimismChainId:
      return 'VITE_UNCHAINED_OPTIMISM_HTTP_URL'
    case bscChainId:
      return 'VITE_UNCHAINED_BNBSMARTCHAIN_HTTP_URL'
    case polygonChainId:
      return 'VITE_UNCHAINED_POLYGON_HTTP_URL'
    case gnosisChainId:
      return 'VITE_UNCHAINED_GNOSIS_HTTP_URL'
    case arbitrumChainId:
      return 'VITE_UNCHAINED_ARBITRUM_HTTP_URL'
    case baseChainId:
      return 'VITE_UNCHAINED_BASE_HTTP_URL'
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

export const getFeeAssetByChainId = (chainId: ChainId): string | undefined => {
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
