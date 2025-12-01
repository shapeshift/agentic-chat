import type { AssetId } from '@shapeshiftoss/caip'
import type { StaticAsset } from '@shapeshiftoss/types'
import { chainIdToNetwork, networkToChainIdMap } from '@shapeshiftoss/types'

import { decodeAssetData } from './assetData/decodeAssetData.js'
import encodedAssetData from './assetData/encodedAssetData.json'
import type { EncodedAssetData } from './assetData/types.js'

class AssetService {
  private static instance: AssetService
  private readonly assetsById: Record<AssetId, StaticAsset>
  private readonly assetsBySymbol: Map<string, StaticAsset[]>
  private readonly assetsByName: Map<string, StaticAsset[]>

  private readonly sortedAssetIds: AssetId[]

  private constructor() {
    const { assetData, sortedAssetIds } = decodeAssetData(encodedAssetData as unknown as EncodedAssetData)

    this.assetsById = assetData
    this.sortedAssetIds = sortedAssetIds

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
      const normalized = network.toLowerCase()
      const candidateChainId = normalized.includes(':')
        ? normalized
        : (networkToChainIdMap as Record<string, string>)[normalized]?.toLowerCase()

      return results.filter(asset => {
        const assetNetwork = chainIdToNetwork[asset.chainId]
        return assetNetwork === normalized || asset.chainId === candidateChainId
      })
    }

    return results
  }

  private scoreMatch(asset: StaticAsset, term: string): number {
    const symbol = asset.symbol.toLowerCase()
    const name = asset.name.toLowerCase()
    const isNative = asset.assetId.includes('/slip44:')

    // Exact symbol match (highest) - native tokens get a small bonus as tiebreaker
    if (symbol === term) return isNative ? 1001 : 1000

    // Exact name match
    if (name === term) return 500

    // Symbol contains - shorter symbols rank higher (closer match)
    if (symbol.includes(term)) return 400 - symbol.length

    // Name contains - shorter names rank higher
    if (name.includes(term)) return 200 - name.length

    return 0
  }

  searchByName(name: string, network?: string): StaticAsset[] {
    const nameLower = name.toLowerCase()
    const exactMatches = this.assetsByName.get(nameLower) || []

    const partialMatches = Array.from(this.assetsByName.entries())
      .filter(([assetName]) => assetName.includes(nameLower) && assetName !== nameLower)
      .flatMap(([, assets]) => assets)

    const results = [...exactMatches, ...partialMatches]

    if (network) {
      const normalized = network.toLowerCase()
      const candidateChainId = normalized.includes(':')
        ? normalized
        : (networkToChainIdMap as Record<string, string>)[normalized]?.toLowerCase()

      return results.filter(asset => {
        const assetNetwork = chainIdToNetwork[asset.chainId]
        return assetNetwork === normalized || asset.chainId === candidateChainId
      })
    }

    return results
  }

  search(term: string, network?: string): StaticAsset[] {
    const termLower = term.toLowerCase()
    const symbolResults = this.searchBySymbol(term, network)
    const nameResults = this.searchByName(term, network)

    const resultMap = new Map<AssetId, StaticAsset>()
    for (const asset of [...symbolResults, ...nameResults]) {
      resultMap.set(asset.assetId, asset)
    }

    return Array.from(resultMap.values())
      .map(asset => ({ asset, score: this.scoreMatch(asset, termLower) }))
      .sort((a, b) => b.score - a.score)
      .map(({ asset }) => asset)
  }

  getSortedAssetIds(): AssetId[] {
    return this.sortedAssetIds
  }
}

export const assetService = AssetService.getInstance()
