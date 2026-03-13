import { describe, expect, mock, test } from 'bun:test'

import { executeGetHistoricalPrices, getHistoricalPricesSchema } from '../getHistoricalPrices'

// Mock local dependencies — avoids polluting global @shapeshiftoss/* modules
void mock.module('../../lib/asset/resolveAsset', () => ({
  searchAsset: (term: string) => {
    const assets: Record<string, { assetId: string } | undefined> = {
      ETH: { assetId: 'eip155:1/slip44:60' },
      BTC: { assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0' },
      NOTFOUND: undefined,
      FAIL: { assetId: 'eip155:1/erc20:0xfailcoin' },
      EMPTY: { assetId: 'eip155:1/erc20:0xemptycoin' },
    }
    return assets[term]
  },
  getAssetMeta: (assetId: string) => {
    const map: Record<string, { symbol: string; name: string } | undefined> = {
      'eip155:1/slip44:60': { symbol: 'ETH', name: 'Ethereum' },
      'bip122:000000000019d6689c085ae165831e93/slip44:0': { symbol: 'BTC', name: 'Bitcoin' },
      'eip155:1/erc20:0xfailcoin': { symbol: 'FAIL', name: 'FailCoin' },
      'eip155:1/erc20:0xemptycoin': { symbol: 'EMPTY', name: 'EmptyCoin' },
    }
    return map[assetId]
  },
  assetIdToCoingecko: (assetId: string) => {
    const map: Record<string, string | undefined> = {
      'eip155:1/slip44:60': 'ethereum',
      'bip122:000000000019d6689c085ae165831e93/slip44:0': 'bitcoin',
      'eip155:1/erc20:0xunmapped': undefined,
      'eip155:1/erc20:0xfailcoin': 'failcoin',
      'eip155:1/erc20:0xemptycoin': 'emptycoin',
    }
    return map[assetId]
  },
}))

void mock.module('../../lib/asset/coingecko/api', () => ({
  getMarketChartRange: async (coinGeckoId: string) => {
    if (coinGeckoId === 'ethereum') {
      return {
        prices: [
          [1704067200000, 2000],
          [1704153600000, 2100],
          [1704240000000, 2200],
          [1704326400000, 2300],
          [1704412800000, 2400],
        ] as [number, number][],
        market_caps: [],
        total_volumes: [],
      }
    }
    if (coinGeckoId === 'bitcoin') {
      return {
        prices: [
          [1704067200000, 40000],
          [1704153600000, 41000],
          [1704240000000, 42000],
          [1704326400000, 43000],
          [1704412800000, 44000],
        ] as [number, number][],
        market_caps: [],
        total_volumes: [],
      }
    }
    if (coinGeckoId === 'emptycoin') {
      return { prices: [] as [number, number][], market_caps: [], total_volumes: [] }
    }
    throw new Error('API error')
  },
}))

describe('getHistoricalPricesSchema', () => {
  test('enforces max 10 assets', () => {
    const input = {
      assets: Array.from({ length: 11 }, () => ({ searchTerm: 'ETH' })),
      startDate: '2024-01-01',
    }
    const result = getHistoricalPricesSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  test('enforces min 1 asset', () => {
    const input = { assets: [], startDate: '2024-01-01' }
    const result = getHistoricalPricesSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  test('defaults dataPoints to 2', () => {
    const input = { assets: [{ searchTerm: 'ETH' }], startDate: '2024-01-01' }
    const result = getHistoricalPricesSchema.parse(input)
    expect(result.dataPoints).toBe(2)
  })

  test('enforces dataPoints max 30', () => {
    const input = { assets: [{ searchTerm: 'ETH' }], startDate: '2024-01-01', dataPoints: 31 }
    const result = getHistoricalPricesSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  test('enforces dataPoints min 1', () => {
    const input = { assets: [{ searchTerm: 'ETH' }], startDate: '2024-01-01', dataPoints: 0 }
    const result = getHistoricalPricesSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  test('accepts valid input', () => {
    const input = {
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      dataPoints: 10,
    }
    const result = getHistoricalPricesSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})

describe('executeGetHistoricalPrices', () => {
  test('returns price data with correct summary fields', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(1)
    const eth = result.results[0] as any
    expect(eth.symbol).toBe('ETH')
    expect(eth.name).toBe('Ethereum')
    expect(eth.assetId).toBe('eip155:1/slip44:60')
    expect(eth.startPrice).toBe(2000)
    expect(eth.endPrice).toBe(2400)
    expect(eth.dataPoints).toHaveLength(2)
  })

  test('computes percent change correctly', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    const eth = result.results[0] as any
    // (2400 - 2000) / 2000 * 100 = 20%
    expect(eth.percentChange).toBe(20)
  })

  test('handles asset not found gracefully (partial failure)', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }, { searchTerm: 'NOTFOUND' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(2)
    const eth = result.results[0] as any
    expect(eth.symbol).toBe('ETH')
    const notFound = result.results[1] as any
    expect(notFound.error).toContain('Asset not found')
  })

  test('returns error when startDate >= endDate', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-06-01',
      endDate: '2024-01-01',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(1)
    const err = result.results[0] as any
    expect(err.error).toContain('startDate must be before endDate')
  })

  test('handles missing assetId and searchTerm', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{}],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(1)
    const err = result.results[0] as any
    expect(err.error).toContain('must have either assetId or searchTerm')
  })

  test('handles no CoinGecko mapping for asset', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ assetId: 'eip155:1/erc20:0xunmapped' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(1)
    const err = result.results[0] as any
    expect(err.error).toContain('No CoinGecko mapping')
  })

  test('fetches multiple assets in parallel', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }, { searchTerm: 'BTC' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(2)
    const eth = result.results[0] as any
    const btc = result.results[1] as any
    expect(eth.symbol).toBe('ETH')
    expect(btc.symbol).toBe('BTC')
    expect(btc.startPrice).toBe(40000)
    expect(btc.endPrice).toBe(44000)
  })

  test('converts timestamps from ms to seconds in dataPoints', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    const eth = result.results[0] as any
    // Timestamps should be in seconds, not milliseconds
    expect(eth.dataPoints[0].timestamp).toBeLessThan(10000000000)
  })

  test('propagates API errors with asset context', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'FAIL' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(1)
    const err = result.results[0] as any
    expect(err.assetId).toBe('eip155:1/erc20:0xfailcoin')
    expect(err.error).toBeDefined()
  })

  test('returns single data point when dataPoints is 1', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 1,
    })

    const eth = result.results[0] as any
    expect(eth.dataPoints).toHaveLength(1)
    expect(eth.startPrice).toBe(eth.endPrice)
  })

  test('returns error when chart data has no prices', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'EMPTY' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(1)
    const err = result.results[0] as any
    expect(err.error).toBeDefined()
  })
})
