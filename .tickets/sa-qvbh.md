---
id: sa-qvbh
status: closed
deps: []
links: []
created: 2026-03-22T23:40:17Z
type: bug
priority: 1
assignee: Jibles
---
# Fix asset search scoring: vault/pool tokens outscore real assets

## Objective

Fix the asset search scoring algorithm in `AssetService.scoreMatch` so that real tokens (e.g., USD Coin) always rank above vault/pool tokens that happen to share the same symbol (e.g., "Morpho Hadjime USDC Prime Pool"). Currently, vault tokens outscore real tokens, causing TWAP and other order creation flows to silently select the wrong asset and fail with misleading errors.

## Context & Findings

**Root cause (confirmed):** The `scoreMatch` algorithm awards a name-contains-term bonus that benefits vault/pool tokens over the actual token:

- Real "USD Coin" (symbol `USDC`): symbol exact match = +1000, name `"usd coin"` does NOT contain `"usdc"` = +0 → **total 1000**
- "Morpho Hadjime USDC Prime Pool" (symbol `USDC`): symbol exact match = +1000, name contains `"usdc"` = +150 - 30 = **+120** → **total 1120**

The ownership bonus in `resolveAsset` is +100, which is not enough to overcome the 120-point gap (1100 < 1120).

**Downstream impact:** When the wrong asset is selected, it has no CoinGecko price mapping → `sellPrice = 0` → `minPartLimit = 0n` → throws `"Unable to calculate minimum buy amount — price data is unavailable"`. The chatbot then misinterprets this as a balance issue.

**Existing infrastructure not being used:**
- `StaticAsset` already has an `isPool: boolean` field (set during asset data decoding)
- `AssetService.searchWithFilters()` already supports `pools: 'exclude'` filtering
- `AssetService.isPool()` checks `asset.isPool || asset.symbol.includes('/')`
- But `resolveAsset` calls `searchWithScores()` directly, bypassing pool filtering

**Rejected approach:** Simply switching `resolveAsset` to `searchWithFilters(term, { pools: 'exclude' })` won't work alone because `searchWithFilters` doesn't return scores, which `resolveAsset` needs for the ownership bonus logic. The fix needs to happen in the scoring algorithm itself.

## Suggested Fix Approaches (combine as needed)

1. **Pool penalty in `scoreMatch`**: If `this.isPool(asset)` is true, subtract a significant penalty (e.g., -500). This ensures real tokens always rank above pool tokens with the same symbol.
2. **CoinGecko mapping bonus**: Assets with a CoinGecko mapping are "real" tradeable tokens. Add a bonus (e.g., +200) for assets that have a CoinGecko ID. This requires passing adapter data or a lookup function into the scoring.
3. **Increase ownership bonus**: Raising `OWNERSHIP_BONUS` from 100 to 300+ would help but is fragile — doesn't solve the root cause and depends on the user owning the token.
4. **Add `searchWithFiltersAndScores`**: A new method combining `searchWithFilters`' filtering with score output, so `resolveAsset` can use pool exclusion AND ownership bonus together.

Approach 1 is the simplest and most robust. Consider combining with approach 4 for defense in depth.

## Testing

Use `guide:e2e-test` with no authentication (none needed — this is pure asset resolution logic, no wallet interaction required).

Write an e2e test file that exercises `AssetService.searchWithScores` (and/or `resolveAsset`) against 20 tokens to validate the algorithm handles all edge cases. Iterate on the scoring algorithm until all 20 pass. The test should:

1. Initialize `AssetService` and `CoinGeckoAdapters` (real data from GitHub, no mocks)
2. For each test case, call the search function with the token name/symbol and optional network
3. Assert the top result is the expected asset (by assetId or contract address)

**Required test tokens (minimum 20):**
- USDC on Gnosis (the original bug — must resolve to `eip155:100/erc20:0xddafbb505ad214d7b80b1f830fccc89b60fb7a83`, NOT Morpho/Silo vault tokens)
- USDC on Ethereum (verify cross-chain doesn't regress)
- USDC on Arbitrum
- USDT on Gnosis
- USDT on Ethereum
- FOX on Ethereum (`eip155:1/erc20:0xc770eefad204b5180df6a14ee197d99d808ee52d` — ShapeShift's token)
- FOX on Gnosis (`eip155:100/erc20:0x21a42669643f45bc0e086b8fc2ed70c23d67509d`)
- FOX on Arbitrum (`eip155:42161/erc20:0xf929de51d91c77e42f5090069e0ad7a09e513c73`)
- WETH on Ethereum
- WETH on Gnosis
- WBTC on Ethereum
- DAI on Ethereum
- DAI on Gnosis
- GNO on Gnosis (native governance token)
- ETH on Ethereum (native token — should get native bonus)
- MATIC on Polygon (native-ish token)
- AAVE on Ethereum (DeFi token that likely has vault derivatives)
- UNI on Ethereum (another DeFi token with LP derivatives)
- LINK on Ethereum
- XDAI on Gnosis (native token)

For each, the real/canonical token must rank #1 over any vault, pool, or wrapped derivative with the same symbol.

## Files

- `packages/utils/src/AssetService.ts` — `scoreMatch` method (lines 120-146), `isPool` helper (lines 195-197). Main fix location.
- `apps/agentic-server/src/utils/assetHelpers.ts` — `resolveAsset` function (lines 14-63). May need adjustment to ownership bonus or to use new filtered search method.
- `packages/utils/src/AssetService.test.ts` — test file (create if needed)

## Gotchas

- The `isPool` field on `StaticAsset` is optional and may not be set on all pool-type tokens. The `isPool()` helper also checks `symbol.includes('/')` as a fallback, but vault tokens like "Morpho USDC" have symbol `USDC` (no slash) — the `isPool` flag from asset data is the only indicator for these.
- Don't break LP token search when users explicitly search for pool tokens (e.g., searching for "USDC/DAI" should still find LP tokens).
- The asset data is fetched from `https://raw.githubusercontent.com/shapeshift/web/develop/public/generated/generatedAssetData.json` — test against real data, not mocks.
- `searchWithScores` is also used by the LLM tool `getAssets` — changes to scoring affect all asset search paths, not just `resolveAsset`.
- The CoinGecko API key in `.env` is a placeholder (`request`). Tests should NOT depend on CoinGecko price API calls — only on the adapter mapping data (loaded from GitHub JSON, no API key needed).
