import type { GroupedPortfolioAsset, PortfolioAsset, PortfolioDelta } from '@/types/portfolio'

import { bn, bnOrZero } from './bignumber'

export function calculate24hDelta(assets: PortfolioAsset[]): PortfolioDelta | null {
  if (assets.length === 0) return null

  const currentTotal = assets.reduce((sum, asset) => sum.plus(bnOrZero(asset.fiatAmount)), bn(0))

  const total24hAgo = assets.reduce((sum, asset) => {
    const priceChange = bnOrZero(asset.priceChange24h)
    const current = bnOrZero(asset.fiatAmount)

    if (!current.isFinite()) return sum

    if (priceChange.isZero() || current.isZero()) return sum.plus(current)

    const denominator = bn(1).plus(priceChange.div(100))
    if (denominator.lte(0)) {
      // Fallback: treat as no usable historical data rather than exploding the delta
      return sum.plus(current)
    }

    const usd24hAgo = current.div(denominator)
    return sum.plus(usd24hAgo)
  }, bn(0))

  if (total24hAgo.isZero()) return null

  const deltaAmount = currentTotal.minus(total24hAgo)
  const deltaPercentage = deltaAmount.div(total24hAgo).times(100)

  return {
    fiatAmount: deltaAmount.toFixed(2),
    percentage: deltaPercentage.toNumber(),
  }
}

export function calculateTotals(assets: PortfolioAsset[]) {
  const totalFiat = assets.reduce((sum, a) => sum.plus(bnOrZero(a.fiatAmount)), bn(0))
  const totalCrypto = assets.reduce((sum, a) => sum.plus(bnOrZero(a.cryptoBalancePrecision)), bn(0))
  const totalAllocation = assets.reduce((sum, a) => sum + a.allocation, 0)

  return {
    totalFiatAmount: totalFiat.toFixed(2),
    totalCryptoBalancePrecision: totalCrypto.toFixed(),
    aggregatedAllocation: totalAllocation,
  }
}

function buildSingleAssetGroup(asset: PortfolioAsset): GroupedPortfolioAsset {
  return {
    primaryAsset: { ...asset, isPrimary: true, isChainSpecific: true },
    relatedAssets: [],
    totalFiatAmount: asset.fiatAmount,
    totalCryptoBalancePrecision: asset.cryptoBalancePrecision,
    aggregatedAllocation: asset.allocation,
  }
}

function buildMultiAssetGroup(assets: PortfolioAsset[], primaryAssetId: string): GroupedPortfolioAsset {
  const sorted = [...assets].sort((a, b) => (bnOrZero(b.fiatAmount).gte(bnOrZero(a.fiatAmount)) ? 1 : -1))
  const primary = sorted[0]!
  const totals = calculateTotals(sorted)

  return {
    primaryAsset: {
      ...primary,
      fiatAmount: totals.totalFiatAmount,
      cryptoBalancePrecision: totals.totalCryptoBalancePrecision,
      allocation: totals.aggregatedAllocation,
      isPrimary: true,
      relatedAssetKey: primaryAssetId,
    },
    relatedAssets: sorted.map(a => ({
      ...a,
      relatedAssetKey: primaryAssetId,
      isPrimary: a.assetId === primary.assetId,
    })),
    ...totals,
  }
}

export function groupPortfolioAssets(assets: PortfolioAsset[]): GroupedPortfolioAsset[] {
  const groupMap = new Map<string, PortfolioAsset[]>()

  for (const asset of assets) {
    const key = asset.relatedAssetKey ?? asset.assetId
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(asset)
  }

  return Array.from(groupMap.values())
    .map(group => {
      const first = group[0]!
      if (group.length === 1) return buildSingleAssetGroup(first)
      return buildMultiAssetGroup(group, first.relatedAssetKey ?? first.assetId)
    })
    .sort((a, b) => (bnOrZero(b.totalFiatAmount).gte(bnOrZero(a.totalFiatAmount)) ? 1 : -1))
}
