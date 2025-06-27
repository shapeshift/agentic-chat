import {
  arbitrumAssetId,
  arbitrumChainId,
  avalancheAssetId,
  avalancheChainId,
  baseAssetId,
  baseChainId,
  bscAssetId,
  bscChainId,
  ethAssetId,
  ethChainId,
  gnosisAssetId,
  gnosisChainId,
  optimismAssetId,
  optimismChainId,
  polygonAssetId,
  polygonChainId,
} from '@shapeshiftoss/caip'
import type { ChainId } from '@shapeshiftoss/caip'

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
