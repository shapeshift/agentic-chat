import type { AssetId } from '@shapeshiftoss/caip'
import { fromChainId } from '@shapeshiftoss/caip'
import type { StaticAsset } from '@shapeshiftoss/types'

import { decodeAssetData } from './assetData/decodeAssetData.js'
import { decodeRelatedAssetIndex } from './assetData/decodeRelatedAssetIndex.js'
import encodedAssetData from './assetData/encodedAssetData.json'
import encodedRelatedAssetIndex from './assetData/encodedRelatedAssetIndex.json'
import type { EncodedAssetData } from './assetData/types.js'

class AssetService {
  private static instance: AssetService
  private readonly assetsById: Record<AssetId, StaticAsset>
  private readonly relatedAssetIndex: Record<AssetId, AssetId[]>
  private readonly assetsBySymbol: Map<string, StaticAsset[]>
  private readonly assetsByName: Map<string, StaticAsset[]>

  private constructor() {
    const { assetData, sortedAssetIds } = decodeAssetData(encodedAssetData as unknown as EncodedAssetData)

    this.assetsById = assetData
    this.relatedAssetIndex = decodeRelatedAssetIndex(encodedRelatedAssetIndex, sortedAssetIds)

    this.assetsBySymbol = new Map()
    this.assetsByName = new Map()

    for (const asset of Object.values(this.assetsById)) {
      const symbolLower = asset.symbol.toLowerCase()
      if (!this.assetsBySymbol.has(symbolLower)) {
        this.assetsBySymbol.set(symbolLower, [])
      }
      this.assetsBySymbol.get(symbolLower)!.push(asset)

      const nameLower = asset.name.toLowerCase()
      if (!this.assetsByName.has(nameLower)) {
        this.assetsByName.set(nameLower, [])
      }
      this.assetsByName.get(nameLower)!.push(asset)
    }
  }

  static getInstance(): AssetService {
    if (!AssetService.instance) {
      AssetService.instance = new AssetService()
    }
    return AssetService.instance
  }

  getAsset(assetId: AssetId): StaticAsset | undefined {
    return this.assetsById[assetId]
  }

  searchBySymbol(symbol: string, network?: string): StaticAsset[] {
    const results = this.assetsBySymbol.get(symbol.toLowerCase()) || []

    if (network) {
      return results.filter(asset => {
        const { chainNamespace, chainReference } = fromChainId(asset.chainId)
        const assetNetwork = `${chainNamespace}:${chainReference}`.toLowerCase()
        return (
          assetNetwork.includes(network.toLowerCase()) || asset.chainId.toLowerCase().includes(network.toLowerCase())
        )
      })
    }

    return results
  }

  searchByName(name: string, network?: string): StaticAsset[] {
    const nameLower = name.toLowerCase()
    const exactMatches = this.assetsByName.get(nameLower) || []

    const partialMatches = Array.from(this.assetsByName.entries())
      .filter(([assetName]) => assetName.includes(nameLower) && assetName !== nameLower)
      .flatMap(([, assets]) => assets)

    const results = [...exactMatches, ...partialMatches]

    if (network) {
      return results.filter(asset => {
        const { chainNamespace, chainReference } = fromChainId(asset.chainId)
        const assetNetwork = `${chainNamespace}:${chainReference}`.toLowerCase()
        return (
          assetNetwork.includes(network.toLowerCase()) || asset.chainId.toLowerCase().includes(network.toLowerCase())
        )
      })
    }

    return results
  }

  search(term: string, network?: string): StaticAsset[] {
    const symbolResults = this.searchBySymbol(term, network)
    const nameResults = this.searchByName(term, network)

    const resultMap = new Map<AssetId, StaticAsset>()
    for (const asset of [...symbolResults, ...nameResults]) {
      resultMap.set(asset.assetId, asset)
    }

    return Array.from(resultMap.values())
  }

  getRelatedAssets(assetId: AssetId): StaticAsset[] {
    const relatedIds = this.relatedAssetIndex[assetId] || []
    return relatedIds.map(id => this.assetsById[id]).filter((asset): asset is StaticAsset => asset !== undefined)
  }
}

export const assetService = AssetService.getInstance()
