import type { AssetId } from '@shapeshiftoss/caip'
import type { Network, StaticAsset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'

import { decodeAssetData } from './assetData/decodeAssetData.js'
import encodedAssetData from './assetData/encodedAssetData.json'
import type { EncodedAssetData } from './assetData/types.js'

class AssetService {
  private static instance: AssetService
  private readonly assetsById: Record<AssetId, StaticAsset>
  private readonly assetsBySymbol: Map<string, StaticAsset[]>
  private readonly assetsByName: Map<string, StaticAsset[]>
  private readonly assetsByContract: Map<string, StaticAsset[]>

  private readonly sortedAssetIds: AssetId[]

  private constructor() {
    const { assetData, sortedAssetIds } = decodeAssetData(encodedAssetData as unknown as EncodedAssetData)

    this.assetsById = assetData
    this.sortedAssetIds = sortedAssetIds

    this.assetsBySymbol = new Map()
    this.assetsByName = new Map()
    this.assetsByContract = new Map()

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

      if (!asset.assetId.includes('/slip44:')) {
        const slashIdx = asset.assetId.indexOf('/')
        const colonIdx = asset.assetId.indexOf(':', slashIdx)
        const contract = asset.assetId.substring(colonIdx + 1).toLowerCase()

        if (!this.assetsByContract.has(contract)) {
          this.assetsByContract.set(contract, [])
        }
        this.assetsByContract.get(contract)!.push(asset)
      }
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

  searchBySymbol(rawSymbol: string, network?: Network): StaticAsset[] {
    const symbol = rawSymbol.toLowerCase()
    const results = this.assetsBySymbol.get(symbol) || []

    if (network) {
      const chainId = networkToChainIdMap[network]
      return results.filter(asset => asset.chainId === chainId)
    }

    return results
  }

  private scoreMatch(asset: StaticAsset, term: string): number {
    const symbol = asset.symbol.toLowerCase()
    const name = asset.name.toLowerCase()
    const isNative = asset.assetId.includes('/slip44:')

    let score = 0

    // Symbol matches (mutually exclusive within this group)
    if (symbol === term) {
      score += 1000
    } else if (symbol.startsWith(term)) {
      score += 500
    } else if (symbol.includes(term)) {
      score += 300 - Math.min(symbol.length, 50)
    }

    // Name matches (cumulative with symbol!)
    if (name === term) {
      score += 500
    } else if (name.startsWith(term)) {
      score += 250
    } else if (name.includes(term)) {
      score += 150 - Math.min(name.length, 50)
    }

    // Additional signals (all cumulative)
    if (isNative) score += 100

    return score
  }

  searchByName(rawName: string, network?: Network): StaticAsset[] {
    const name = rawName.toLowerCase()
    const exactMatches = this.assetsByName.get(name) || []

    const partialMatches = Array.from(this.assetsByName.entries())
      .filter(([assetName]) => assetName.includes(name) && assetName !== name)
      .flatMap(([, assets]) => assets)

    const results = [...exactMatches, ...partialMatches]

    if (network) {
      const chainId = networkToChainIdMap[network]
      return results.filter(asset => asset.chainId === chainId)
    }

    return results
  }

  searchWithScores(rawTerm: string, network?: Network): Array<{ asset: StaticAsset; score: number }> {
    const term = rawTerm.toLowerCase()
    const symbolResults = this.searchBySymbol(term, network)
    const nameResults = this.searchByName(term, network)

    const resultMap = new Map<AssetId, StaticAsset>()
    for (const asset of [...symbolResults, ...nameResults]) {
      resultMap.set(asset.assetId, asset)
    }

    return Array.from(resultMap.values())
      .map(asset => ({ asset, score: this.scoreMatch(asset, term) }))
      .sort((a, b) => b.score - a.score)
  }

  search(rawTerm: string, network?: Network): StaticAsset[] {
    return this.searchWithScores(rawTerm, network).map(({ asset }) => asset)
  }

  searchByContract(rawContractAddress: string, network?: Network): StaticAsset[] {
    const contractAddress = rawContractAddress.toLowerCase()
    const results = this.assetsByContract.get(contractAddress) || []

    if (!network) return results

    const chainId = networkToChainIdMap[network]
    return results.filter(asset => asset.chainId === chainId)
  }

  private isPool(asset: StaticAsset): boolean {
    return asset.isPool || asset.symbol.includes('/')
  }

  searchWithFilters(
    term: string,
    options?: {
      network?: Network
      assetType?: 'all' | 'native' | 'token'
      pools?: 'exclude' | 'include' | 'only'
    }
  ): StaticAsset[] {
    const { network, assetType = 'all', pools = 'include' } = options ?? {}

    let results = this.search(term, network)

    if (assetType === 'native') {
      results = results.filter(a => a.assetId.includes('/slip44:'))
    } else if (assetType === 'token') {
      results = results.filter(a => !a.assetId.includes('/slip44:'))
    }

    if (pools === 'exclude') {
      results = results.filter(a => !this.isPool(a))
    } else if (pools === 'only') {
      results = results.filter(a => this.isPool(a))
    }

    return results
  }

  getSortedAssetIds(): AssetId[] {
    return this.sortedAssetIds
  }
}

export const assetService = AssetService.getInstance()
