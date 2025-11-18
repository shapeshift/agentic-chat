import type { PortfolioDataFull } from '../../tools/portfolio'

interface CachedPortfolio {
  data: PortfolioDataFull
  timestamp: number
  expiresAt: number
}

const cache = new Map<string, CachedPortfolio>()

const TTL_MS = 30 * 1000 // 30 seconds (matches UI refresh interval)
const MAX_ENTRIES = 100 // 100 entries across all networks and addresses

export function getCacheKey(address: string, network: string): string {
  return JSON.stringify({
    address: address.toLowerCase(),
    network,
  })
}

export function get(key: string): PortfolioDataFull | null {
  const entry = cache.get(key)

  if (!entry) {
    return null
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }

  return entry.data
}

export function set(key: string, data: PortfolioDataFull): void {
  // LRU eviction: remove oldest entry when cache is full
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  cache.set(key, {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  })
}
