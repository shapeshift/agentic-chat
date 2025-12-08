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

    // Exact symbol match (highest) - native tokens get a small bonus as tiebreaker
    // Add bonus if name also matches exactly
    if (symbol === term) return (isNative ? 1001 : 1000) + (name === term ? 500 : 0)

    // Exact name match
    if (name === term) return 500

    // Symbol contains - shorter symbols rank higher (closer match)
    if (symbol.includes(term)) return 400 - symbol.length

    // Name contains - shorter names rank higher
    if (name.includes(term)) return 200 - name.length

    return 0
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

  search(rawTerm: string, network?: Network): StaticAsset[] {
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
      .map(({ asset }) => asset)
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
    const { network, assetType = 'all', pools = 'exclude' } = options ?? {}

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
