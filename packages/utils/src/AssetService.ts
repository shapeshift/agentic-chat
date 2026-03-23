import type { AssetId } from '@shapeshiftoss/caip'
import type { Network, StaticAsset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'

const ASSET_DATA_URL =
  'https://raw.githubusercontent.com/shapeshift/web/develop/public/generated/generatedAssetData.json'

class AssetService {
  private static instance: AssetService | null = null
  private static initializedAt: number = 0
  private static refreshing: boolean = false
  private static MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 2 weeks
  private static onStaleCallback: (() => Promise<void>) | null = null

  private readonly assetsById: Record<AssetId, StaticAsset>
  private readonly assetsBySymbol: Map<string, StaticAsset[]>
  private readonly assetsByName: Map<string, StaticAsset[]>
  private readonly assetsByContract: Map<string, StaticAsset[]>
  private readonly sortedAssetIds: AssetId[]

  private constructor(assetData: Record<AssetId, StaticAsset>, sortedAssetIds: AssetId[]) {
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

  static async initialize(): Promise<void> {
    if (AssetService.instance) return
    await AssetService.fetchAndBuild()
  }

  static async refresh(): Promise<void> {
    await AssetService.fetchAndBuild()
  }

  private static async fetchAndBuild(): Promise<void> {
    const response = await fetch(ASSET_DATA_URL)
    if (!response.ok) throw new Error(`Failed to fetch asset data: HTTP ${response.status}`)
    // Use arrayBuffer + TextDecoder to avoid bun hanging on large .text()/.json() responses
    const buf = await response.arrayBuffer()
    const data = JSON.parse(new TextDecoder().decode(buf)) as { byId: Record<AssetId, StaticAsset> }
    const assetData = data.byId
    const sortedAssetIds = Object.keys(assetData)
    AssetService.instance = new AssetService(assetData, sortedAssetIds)
    AssetService.initializedAt = Date.now()
  }

  static setOnStale(callback: () => Promise<void>): void {
    AssetService.onStaleCallback = callback
  }

  static getInstanceOrNull(): AssetService | null {
    return AssetService.instance
  }

  static getIcon(assetId: AssetId): string | undefined {
    return AssetService.instance?.getAsset(assetId)?.icon
  }

  static getInstance(): AssetService {
    if (!AssetService.instance) throw new Error('AssetService not initialized. Call AssetService.initialize() first.')

    if (!AssetService.refreshing && Date.now() - AssetService.initializedAt > AssetService.MAX_AGE_MS) {
      AssetService.refreshing = true
      const refresh = AssetService.onStaleCallback ?? AssetService.fetchAndBuild.bind(AssetService)
      refresh()
        .then(() => console.log('Asset data refreshed in background'))
        .catch(err => console.error('Background asset refresh failed:', err))
        .finally(() => {
          AssetService.refreshing = false
        })
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

    if (symbol === term) {
      score += 1000
    } else if (symbol.startsWith(term)) {
      score += 500
    } else if (symbol.includes(term)) {
      score += 300 - Math.min(symbol.length, 50)
    }

    if (name === term) {
      score += 500
    } else if (name.startsWith(term)) {
      score += 250
    } else if (name.includes(term)) {
      score += 150 - Math.min(name.length, 50)
    }

    if (isNative) score += 100
    if (this.isPool(asset)) score -= 500

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

export { AssetService }
