---
id: sa-xwbn
status: closed
deps: []
links: []
created: 2026-03-13T00:56:54Z
type: task
priority: 2
assignee: Jibles
---
# Historical Asset Pricing — Research Brief

# Historical Asset Pricing

## Problem Statement
The agent can't answer questions about past prices ("what was ETH worth 2 months ago?", "how much has my portfolio grown?"). Users need historical price data for single assets, comparisons, and portfolio valuation at past dates. The tool should support bulk lookups (like `getAssetPrices`) so the LLM can combine with wallet balances for portfolio calculations.

## Research Findings

### Current State
- All pricing flows through CoinGecko Pro API (`api.ts`) — only current prices, no historical
- `getAssetPrices` tool is the model: accepts array of `{assetId?, searchTerm?, network?}`, resolves to CAIP-19 IDs, bulk-fetches from CoinGecko, returns enriched results
- `assetIdToCoingecko()` mapping handles asset ID → CoinGecko ID conversion (O(1) map lookups, already used in bulk)
- `date-fns` v4.1.0 is a dependency, already imported in `chat.ts` — available for date math
- System prompt already injects current date + unix timestamp, so LLM can compute relative dates

### Available Tools & Patterns
- Tool pattern: zod schema with `.describe()` → `execute` function → exported tool object
- `getAssetPrices` accepts `assets: [{assetId?, searchTerm?, network?}]` — resolves via AssetService search, then bulk CoinGecko call
- `getSimplePrices(assetIds)` in `lib/asset/coingecko/api.ts` handles the assetId→coingeckoId mapping and batch API call
- Tools registered in `routes/chat.ts` `buildTools()` — non-wallet tools wrapped directly
- `transactionHistory` tool shows date range parameter pattern (`dateFrom`, `dateTo`)
- No tool index file — each tool imported directly in `chat.ts`

### External Context

**CoinGecko Pro (already integrated):**
- `GET /coins/{id}/market_chart?vs_currency=usd&days=N` — time series, auto-granularity (daily 90d+, hourly 2-90d, 5min 1d)
- `GET /coins/{id}/market_chart/range?from=&to=&vs_currency=usd` — custom date range
- `GET /coins/{id}/history?date=dd-mm-yyyy` — single-date snapshot with full market data
- Pro tier: full history back to 2014, generous rate limits
- Solana confirmed working (coin ID: `solana`)
- Per-coin endpoints only (no batch market_chart)
- Cache: 30s (1d), 30min (2-90d), 12h (90d+)
- Docs: https://docs.coingecko.com/v3.0.1/reference/coins-id-market-chart

**DeFiLlama (free, no auth, coins.llama.fi):**
- `GET /prices/historical/{timestamp}/{coins}` — true batch (comma-separated coins), returns price at timestamp
- `GET /chart/{coins}?start=&span=&period=1d` — time series chart
- `GET /percentage/{coins}?period=` — direct growth percentage
- `POST /batchHistorical` — multiple coins × multiple timestamps in one call
- Token format: `chain:address` or `coingecko:{id}` — all EVM chains + Solana confirmed
- Response includes `confidence` score (0-1) and `decimals`, `symbol`
- Docs: https://defillama.com/docs/api

### Validated Behaviors
- CoinGecko `market_chart` returns `{ prices: [[timestamp_ms, price], ...], market_caps: [...], total_volumes: [...] }`
- CoinGecko `history` returns full coin snapshot with `market_data.current_price.usd` for that date
- DeFiLlama `prices/historical` returns `{ coins: { "coingecko:ethereum": { price, timestamp, confidence, symbol } } }`
- DeFiLlama `chart` returns `{ coins: { "coingecko:ethereum": { symbol, confidence, prices: [{timestamp, price}] } } }`
- `assetIdToCoingecko()` returns `undefined` for unmapped tokens — current code defaults to price '0'
- DeFiLlama Avalanche USDC returned anomalous $0.74 — confidence field should be checked

## Constraints
- CoinGecko `market_chart` is per-coin (no batch) — portfolio of 10 assets = 10 API calls
- CoinGecko `history` uses `dd-mm-yyyy` date format (not unix timestamp)
- `assetIdToCoingecko()` returns `undefined` for some tokens — need fallback
- CoinGecko forced interval control (5m, hourly) on `market_chart/range` is Enterprise-only
- Auto-granularity: can't get hourly for >90d ranges on Pro tier
- DeFiLlama has occasional data anomalies on certain chain/token combos

## Dead Ends
- **CoinCap v3** — old v2 API is dead (DNS doesn't resolve). v3 gives only 50 free credits (~30 calls), then requires on-chain USDC payment ($1/500 credits). Fewer assets (~1000 vs CoinGecko 15K+), no contract-address-based historical lookup. Not viable as free or primary source.

## Loose Recommendations
- CoinGecko `market_chart` fits naturally as primary — same client, same ID mapping, already proven
- DeFiLlama is a strong complement for batch historical lookups (true batch in one call) and as fallback for tokens missing CoinGecko mappings
- Tool can mirror `getAssetPrices` input pattern — same `assets` array with `assetId/searchTerm/network` — plus date/time parameter
- For "how much has X grown?", time series (`market_chart`) is more useful than single snapshot — LLM computes delta
- For "portfolio value at date X", DeFiLlama batch endpoint is more efficient than N individual CoinGecko calls
- `date-fns` already available for converting relative dates to timestamps/formatted dates

## Open Questions
- Should we expose both "price at date" and "price chart over range" as separate tools, or one tool with mode selection?
- Should DeFiLlama be fallback only, or primary for batch queries?
- How to handle tokens with no CoinGecko mapping and no contract address?
- Should the tool return raw time series data, or pre-compute useful metrics (start price, end price, % change)?

## Notes

**2026-03-13T01:29:37Z**

# Design

## Architecture

Single tool `getHistoricalPrices` following the existing `getAssetPrices` pattern:

- **Input:** `assets` array (same `{assetId?, searchTerm?, network?}` shape), `startDate` (ISO string), `endDate` (ISO string, defaults to now), `dataPoints` (1-30, default 2)
- **Resolution:** Same AssetService search → CAIP-19 → `assetIdToCoingecko()` pipeline
- **Fetch:** CoinGecko `market_chart/range` per resolved coin, parallelized with `Promise.all`
- **Downsample:** Pick `dataPoints` evenly-spaced entries from the returned time series
- **Output:** Per-asset array of `{ timestamp, price }` plus computed `startPrice`, `endPrice`, `percentChange`

Summary fields (`startPrice`, `endPrice`, `percentChange`) come from the first and last downsampled points — gives the LLM a quick answer without parsing the array for simple growth questions.

## Data Flow

1. LLM calls `getHistoricalPrices` with assets + date range + dataPoints
2. Resolve each asset via AssetService search (same as `getAssetPrices`) → CAIP-19 IDs
3. Map CAIP-19 → CoinGecko ID via `assetIdToCoingecko()`
4. `Promise.all` — fetch `market_chart/range?vs_currency=usd&from={startUnix}&to={endUnix}` for each resolved coin
5. Each response returns `{ prices: [[timestamp_ms, price], ...] }` — take the `prices` array
6. Downsample: divide array into `dataPoints` evenly-spaced indices, pick those entries
7. Return per-asset result: `{ asset, dataPoints: [{timestamp, price}], startPrice, endPrice, percentChange }`

**Unmapped tokens:** If `assetIdToCoingecko()` returns `undefined`, skip with error message in response rather than failing the batch.

**Rate limits:** Cap at 10 assets per call — more than 10 returns an error telling the LLM to narrow the selection.

## Error Handling

- **Asset not found:** AssetService search returns no match → include in response with error string, don't fail the batch
- **No CoinGecko mapping:** `assetIdToCoingecko()` returns `undefined` → same treatment, skip with error message
- **CoinGecko API error:** Individual coin fetch fails → catch per-promise, return error for that asset, don't fail the batch
- **Too many assets:** More than 10 → reject with message telling the LLM to reduce the list
- **Invalid date range:** `startDate` after `endDate`, or future `startDate` → reject with descriptive error
- **dataPoints out of range:** Clamp to 1-30 silently

Partial success pattern throughout — return what we can, report what we couldn't.

## Testing Approach

- Unit test downsampling function in isolation (even spacing, edge cases like fewer points than requested, single point)
- Unit test date validation and asset count validation
- Integration test with mocked CoinGecko responses: asset resolution → fetch → downsample → response shape
- Test partial failure: one asset resolves, one doesn't — verify both appear correctly

## Approved Approach

CoinGecko-only, single tool (`getHistoricalPrices`), client-side downsampling with max 30 data points. Mirrors `getAssetPrices` input pattern. Portfolio growth queries are out of scope — future separate tool/feature.

**2026-03-13T01:33:02Z**

# Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use /run tk:sa-xwbn to implement this plan task-by-task via subagent-driven-development.

**Goal:** Add a `getHistoricalPrices` tool that fetches historical price data from CoinGecko for one or more assets over a date range, with client-side downsampling.

**Architecture:** Single tool mirroring `getAssetPrices` input pattern. Resolves assets via AssetService search → CAIP-19 → CoinGecko ID, then fetches `market_chart/range` per coin in parallel. Downsamples response to N evenly-spaced data points. Partial success pattern — individual asset failures don't fail the batch.

**Tech Stack:** CoinGecko Pro API (`market_chart/range`), zod schemas, axios (existing client), date-fns (already a dependency), bun:test

---

### Task 1: Add `MarketChartRangeResponse` type

**Files:**
- Modify: `apps/agentic-server/src/lib/asset/coingecko/types.ts`

**Step 1: Add the type at the end of the types file (before the trimmed output types section)**

```typescript
// Historical market chart types
export type MarketChartRangeResponse = {
  prices: [number, number][] // [timestamp_ms, price]
  market_caps: [number, number][]
  total_volumes: [number, number][]
}
```

Add this block above the `// Trimmed output types for tools` comment (around line 191).

**Step 2: Commit**

```bash
git add apps/agentic-server/src/lib/asset/coingecko/types.ts
git commit -m "feat: add MarketChartRangeResponse type for historical pricing"
```

---

### Task 2: Add `getMarketChartRange` API function

**Files:**
- Modify: `apps/agentic-server/src/lib/asset/coingecko/api.ts`
- Modify: `apps/agentic-server/src/lib/asset/coingecko/index.ts`

**Step 1: Import the new type in api.ts**

Add `MarketChartRangeResponse` to the existing type import block at line 5:

```typescript
import type {
  CategoriesResponse,
  CoinResponse,
  MarketChartRangeResponse,
  NewCoinsResponse,
  SimplePriceData,
  SimplePriceResult,
  TopGainersLosersResponse,
  TrendingPoolsResponse,
  TrendingSearchResponse,
} from './types'
```

**Step 2: Add the function after `getMarketData` (after line 29)**

```typescript
export async function getMarketChartRange(
  coinGeckoId: string,
  fromUnix: number,
  toUnix: number
): Promise<MarketChartRangeResponse> {
  const { data } = await client.get<MarketChartRangeResponse>(`/coins/${coinGeckoId}/market_chart/range`, {
    params: {
      vs_currency: 'usd',
      from: fromUnix,
      to: toUnix,
    },
  })
  return data
}
```

**Step 3: Re-export from index.ts**

Add `getMarketChartRange` to the export list in `apps/agentic-server/src/lib/asset/coingecko/index.ts`:

```typescript
export {
  getMarketChartRange,
  getMarketData,
  getSimplePrices,
  getTrendingSearch,
  getTopGainersLosers,
  getTrendingPools,
  getCategories,
  getNewCoins,
} from './api'
```

Also add to the type exports:

```typescript
export type {
  CoinResponse,
  MarketChartRangeResponse,
  SimplePriceResult,
  // ... rest unchanged
} from './types'
```

**Step 4: Commit**

```bash
git add apps/agentic-server/src/lib/asset/coingecko/api.ts apps/agentic-server/src/lib/asset/coingecko/index.ts
git commit -m "feat: add getMarketChartRange CoinGecko API function"
```

---

### Task 3: Write downsample utility with tests (TDD)

**Files:**
- Create: `apps/agentic-server/src/lib/asset/coingecko/downsample.ts`
- Create: `apps/agentic-server/src/lib/asset/coingecko/__tests__/downsample.test.ts`

**Step 1: Write the failing tests**

Create `apps/agentic-server/src/lib/asset/coingecko/__tests__/downsample.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test'

import { downsample } from '../downsample'

describe('downsample', () => {
  const tenPoints: [number, number][] = [
    [1000, 100],
    [2000, 110],
    [3000, 105],
    [4000, 120],
    [5000, 115],
    [6000, 130],
    [7000, 125],
    [8000, 140],
    [9000, 135],
    [10000, 150],
  ]

  test('returns evenly spaced points', () => {
    const result = downsample(tenPoints, 3)
    expect(result).toHaveLength(3)
    // first, middle, last
    expect(result[0]).toEqual([1000, 100])
    expect(result[2]).toEqual([10000, 150])
  })

  test('returns all points when dataPoints >= array length', () => {
    const result = downsample(tenPoints, 10)
    expect(result).toHaveLength(10)
    expect(result).toEqual(tenPoints)
  })

  test('returns all points when dataPoints > array length', () => {
    const result = downsample(tenPoints, 20)
    expect(result).toHaveLength(10)
    expect(result).toEqual(tenPoints)
  })

  test('returns single point (last) when dataPoints is 1', () => {
    const result = downsample(tenPoints, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([10000, 150])
  })

  test('returns first and last when dataPoints is 2', () => {
    const result = downsample(tenPoints, 2)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([1000, 100])
    expect(result[1]).toEqual([10000, 150])
  })

  test('returns empty array for empty input', () => {
    expect(downsample([], 5)).toEqual([])
  })

  test('returns single element for single element input', () => {
    const result = downsample([[1000, 100]], 5)
    expect(result).toEqual([[1000, 100]])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/agentic-server && bun test src/lib/asset/coingecko/__tests__/downsample.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `apps/agentic-server/src/lib/asset/coingecko/downsample.ts`:

```typescript
export function downsample(points: [number, number][], dataPoints: number): [number, number][] {
  if (points.length === 0) return []
  if (dataPoints >= points.length) return points

  if (dataPoints === 1) return [points[points.length - 1]]

  const result: [number, number][] = []
  for (let i = 0; i < dataPoints; i++) {
    const index = Math.round((i * (points.length - 1)) / (dataPoints - 1))
    result.push(points[index])
  }
  return result
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/agentic-server && bun test src/lib/asset/coingecko/__tests__/downsample.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add apps/agentic-server/src/lib/asset/coingecko/downsample.ts apps/agentic-server/src/lib/asset/coingecko/__tests__/downsample.test.ts
git commit -m "feat: add downsample utility for historical price data"
```

---

### Task 4: Write `getHistoricalPrices` tool with tests (TDD)

**Files:**
- Create: `apps/agentic-server/src/tools/getHistoricalPrices.ts`
- Create: `apps/agentic-server/src/tools/__tests__/getHistoricalPrices.test.ts`

**Step 1: Write the failing tests**

Create `apps/agentic-server/src/tools/__tests__/getHistoricalPrices.test.ts`:

```typescript
import { describe, expect, mock, test, beforeEach } from 'bun:test'

import { getHistoricalPricesSchema, executeGetHistoricalPrices } from '../getHistoricalPrices'

// Mock the coingecko API
const mockGetMarketChartRange = mock(() =>
  Promise.resolve({
    prices: [
      [1704067200000, 2300],
      [1704153600000, 2350],
      [1704240000000, 2400],
      [1704326400000, 2380],
      [1704412800000, 2450],
    ] as [number, number][],
    market_caps: [],
    total_volumes: [],
  })
)

mock.module('../lib/asset/coingecko/api', () => ({
  getMarketChartRange: mockGetMarketChartRange,
}))

// Mock AssetService
const mockSearchWithFilters = mock(() => [{ assetId: 'eip155:1/slip44:60' }])
mock.module('@shapeshiftoss/utils', () => ({
  AssetService: {
    getInstance: () => ({
      searchWithFilters: mockSearchWithFilters,
    }),
  },
}))

// Mock assetIdToCoingecko
mock.module('@shapeshiftoss/caip', () => ({
  assetIdToCoingecko: () => 'ethereum',
}))

describe('getHistoricalPricesSchema', () => {
  test('validates valid input with ISO dates', () => {
    const input = {
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-02-01',
      dataPoints: 5,
    }
    expect(() => getHistoricalPricesSchema.parse(input)).not.toThrow()
  })

  test('rejects more than 10 assets', () => {
    const input = {
      assets: Array.from({ length: 11 }, (_, i) => ({ searchTerm: `TOKEN${i}` })),
      startDate: '2024-01-01',
    }
    expect(() => getHistoricalPricesSchema.parse(input)).toThrow()
  })

  test('rejects dataPoints > 30', () => {
    const input = {
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      dataPoints: 31,
    }
    expect(() => getHistoricalPricesSchema.parse(input)).toThrow()
  })

  test('defaults dataPoints to 2', () => {
    const input = {
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
    }
    const parsed = getHistoricalPricesSchema.parse(input)
    expect(parsed.dataPoints).toBe(2)
  })
})

describe('executeGetHistoricalPrices', () => {
  beforeEach(() => {
    mockGetMarketChartRange.mockClear()
    mockSearchWithFilters.mockClear()
  })

  test('returns price data with summary fields', async () => {
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-02-01',
      dataPoints: 2,
    })

    expect(result.results).toHaveLength(1)
    const ethResult = result.results[0]
    expect(ethResult.assetId).toBe('eip155:1/slip44:60')
    expect(ethResult.dataPoints).toHaveLength(2)
    expect(ethResult.startPrice).toBeDefined()
    expect(ethResult.endPrice).toBeDefined()
    expect(ethResult.percentChange).toBeDefined()
  })

  test('computes percent change correctly', async () => {
    // Mock returns prices from 2300 to 2450
    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'ETH' }],
      startDate: '2024-01-01',
      endDate: '2024-01-05',
      dataPoints: 2,
    })

    const ethResult = result.results[0]
    expect(ethResult.startPrice).toBe(2300)
    expect(ethResult.endPrice).toBe(2450)
    // (2450 - 2300) / 2300 * 100 ≈ 6.52
    expect(ethResult.percentChange).toBeCloseTo(6.52, 1)
  })

  test('handles asset not found gracefully', async () => {
    mockSearchWithFilters.mockReturnValueOnce([])

    const result = await executeGetHistoricalPrices({
      assets: [{ searchTerm: 'NONEXISTENT' }],
      startDate: '2024-01-01',
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].error).toBeDefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/agentic-server && bun test src/tools/__tests__/getHistoricalPrices.test.ts`
Expected: FAIL — module not found

**Step 3: Write the tool implementation**

Create `apps/agentic-server/src/tools/getHistoricalPrices.ts`:

```typescript
import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import { NETWORKS } from '@shapeshiftoss/types'
import { AssetService } from '@shapeshiftoss/utils'
import { getUnixTime, parseISO } from 'date-fns'
import { z } from 'zod'

import { getMarketChartRange } from '../lib/asset/coingecko/api'
import { downsample } from '../lib/asset/coingecko/downsample'

export const getHistoricalPricesSchema = z.object({
  assets: z
    .array(
      z.object({
        assetId: z.string().optional().describe('CAIP-19 assetId (e.g., "eip155:1/erc20:0xa0b8...")'),
        searchTerm: z.string().optional().describe('Search by symbol or name (e.g., "ETH", "USDC", "Bitcoin")'),
        network: z.enum(NETWORKS).optional().describe('Network to search on (e.g., "ethereum", "arbitrum")'),
      })
    )
    .min(1)
    .max(10)
    .describe('Array of assets to get historical prices for (max 10)'),
  startDate: z.string().describe('Start date as ISO 8601 string (e.g., "2024-01-01", "2024-06-15T00:00:00Z")'),
  endDate: z.string().optional().describe('End date as ISO 8601 string. Defaults to now.'),
  dataPoints: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(2)
    .describe('Number of evenly-spaced price points to return (1-30, default 2 for start/end comparison)'),
})

export type GetHistoricalPricesInput = z.infer<typeof getHistoricalPricesSchema>

type AssetPriceResult = {
  assetId: string
  symbol: string
  name: string
  dataPoints: { timestamp: number; price: number }[]
  startPrice: number
  endPrice: number
  percentChange: number
}

type AssetPriceError = {
  searchTerm?: string
  assetId?: string
  error: string
}

export type GetHistoricalPricesOutput = {
  results: (AssetPriceResult | AssetPriceError)[]
}

export async function executeGetHistoricalPrices(
  input: GetHistoricalPricesInput
): Promise<GetHistoricalPricesOutput> {
  console.log('[getHistoricalPrices]:', input)

  const startUnix = getUnixTime(parseISO(input.startDate))
  const endUnix = input.endDate ? getUnixTime(parseISO(input.endDate)) : Math.floor(Date.now() / 1000)

  if (startUnix >= endUnix) {
    return { results: [{ error: 'startDate must be before endDate' }] }
  }

  // Resolve assets to CAIP-19 IDs and CoinGecko IDs
  type ResolvedAsset = { assetId: string; coinGeckoId: string; symbol: string; name: string }
  const resolved: (ResolvedAsset | AssetPriceError)[] = input.assets.map(assetInput => {
    let assetId: string

    if (assetInput.assetId) {
      assetId = assetInput.assetId
    } else if (assetInput.searchTerm) {
      const result = AssetService.getInstance().searchWithFilters(assetInput.searchTerm, {
        network: assetInput.network,
      })[0]
      if (!result) {
        return {
          searchTerm: assetInput.searchTerm,
          error: `Asset not found: ${assetInput.searchTerm}${assetInput.network ? ` on ${assetInput.network}` : ''}`,
        }
      }
      assetId = result.assetId
    } else {
      return { error: 'Each asset must have either assetId or searchTerm' }
    }

    const coinGeckoId = assetIdToCoingecko(assetId)
    if (!coinGeckoId) {
      return { assetId, error: `No CoinGecko mapping for asset: ${assetId}` }
    }

    const asset = AssetService.getInstance().getAsset(assetId)
    return {
      assetId,
      coinGeckoId,
      symbol: asset?.symbol ?? 'UNKNOWN',
      name: asset?.name ?? 'Unknown',
    }
  })

  // Fetch historical data in parallel for resolved assets
  const results: (AssetPriceResult | AssetPriceError)[] = await Promise.all(
    resolved.map(async item => {
      if ('error' in item) return item

      try {
        const chartData = await getMarketChartRange(item.coinGeckoId, startUnix, endUnix)
        const sampled = downsample(chartData.prices, input.dataPoints)
        const dataPoints = sampled.map(([ts, price]) => ({ timestamp: Math.floor(ts / 1000), price }))

        if (dataPoints.length === 0) {
          return { ...item, error: 'No price data available for this date range' }
        }

        const startPrice = dataPoints[0].price
        const endPrice = dataPoints[dataPoints.length - 1].price
        const percentChange = startPrice !== 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0

        return {
          assetId: item.assetId,
          symbol: item.symbol,
          name: item.name,
          dataPoints,
          startPrice,
          endPrice,
          percentChange: Math.round(percentChange * 100) / 100,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { assetId: item.assetId, error: `Failed to fetch historical data: ${message}` }
      }
    })
  )

  return { results }
}

export const getHistoricalPricesTool = {
  description: `Get historical price data for assets over a date range. Returns evenly-spaced price points plus start/end price and percent change. Use for questions like "what was ETH worth 2 months ago?" or "how much has BTC grown since January?".

Examples:
- { assets: [{ searchTerm: "ETH" }], startDate: "2024-01-01" }
- { assets: [{ searchTerm: "BTC" }, { searchTerm: "ETH" }], startDate: "2024-01-01", endDate: "2024-06-01", dataPoints: 10 }
- { assets: [{ assetId: "eip155:1/slip44:60" }], startDate: "2024-06-01", dataPoints: 5 }`,
  inputSchema: getHistoricalPricesSchema,
  execute: executeGetHistoricalPrices,
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/agentic-server && bun test src/tools/__tests__/getHistoricalPrices.test.ts`
Expected: All tests PASS

Note: The mocking approach may need adjustment depending on how bun:test resolves module mocks with relative imports. If mocks don't intercept correctly, refactor mock paths to match the actual import paths. The test file may need `mock.module` paths adjusted to be relative from the test file location (e.g., `../../lib/asset/coingecko/api`).

**Step 5: Commit**

```bash
git add apps/agentic-server/src/tools/getHistoricalPrices.ts apps/agentic-server/src/tools/__tests__/getHistoricalPrices.test.ts
git commit -m "feat: add getHistoricalPrices tool with tests"
```

---

### Task 5: Register the tool in chat.ts

**Files:**
- Modify: `apps/agentic-server/src/routes/chat.ts`

**Step 1: Add the import**

Add after the `getAssetPricesTool` import (line 22):

```typescript
import { getHistoricalPricesTool } from '../tools/getHistoricalPrices'
```

**Step 2: Register in buildTools**

Add `getHistoricalPricesTool` to the first `wrapTools` group (the non-wallet group), after `getAssetPricesTool` (line 128):

```typescript
    ...wrapTools({
      mathCalculatorTool: mathCalculator,
      getAssetsTool,
      getAssetPricesTool,
      getHistoricalPricesTool,
      lookupExternalAddress: lookupExternalAddressTool,
      // ... rest unchanged
    }),
```

**Step 3: Commit**

```bash
git add apps/agentic-server/src/routes/chat.ts
git commit -m "feat: register getHistoricalPrices tool"
```

---

### Task 6: Run full test suite and verify

**Step 1: Run all tests**

Run: `cd apps/agentic-server && bun test`
Expected: All existing tests still pass, new tests pass

**Step 2: If any failures, fix them**

**Step 3: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: resolve test issues from historical pricing integration"
```

**2026-03-13T02:14:11Z**

Tasks 1-6 complete: Added MarketChartRangeResponse type, getMarketChartRange API function, downsample utility, getHistoricalPrices tool with 17 tests, registered in chat router. Full suite 231/231 passing.
