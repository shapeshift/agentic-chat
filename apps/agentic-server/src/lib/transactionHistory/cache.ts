import type { EvmTx, SolanaTx } from './schemas'

export type RawTransaction = EvmTx | SolanaTx

export interface TransactionPage {
  txs: RawTransaction[]
  cursor?: string
}

interface CachedPage {
  data: TransactionPage
  timestamp: number
  expiresAt: number
}

const cache = new Map<string, CachedPage>()

const TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ENTRIES = 200 // ~200 pages across all networks and addresses

export function getCacheKey(address: string, network: string, cursor?: string): string {
  return JSON.stringify({
    address: address.toLowerCase(),
    network,
    page: cursor || 'initial',
  })
}

export function get(key: string): TransactionPage | null {
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

export function set(key: string, data: TransactionPage): void {
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

export function clear(): void {
  cache.clear()
}

export function getStats() {
  const now = Date.now()
  const validEntries = Array.from(cache.values()).filter(entry => entry.expiresAt > now)

  return {
    totalEntries: cache.size,
    validEntries: validEntries.length,
    expiredEntries: cache.size - validEntries.length,
  }
}
