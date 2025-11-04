import type { AssetWithMarketData } from '@shapeshiftoss/agentic-server/src/lib/asset/coingecko/getCoingeckoAssetDetailsById'
import type { DynamicToolUIPart } from 'ai'
import { TrendingDown, TrendingUp } from 'lucide-react'
import React, { useState } from 'react'

import { Skeleton } from '../ui/skeleton'
import { StatusText } from '../ui/StatusText'
import { TxStepCard } from '../ui/TxStepCard'

interface GetAssetDetailsUIProps {
  toolPart: DynamicToolUIPart
}

function formatNumber(value: string | number | null, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'N/A'

  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(decimals)}B`
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(decimals)}M`
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(decimals)}K`
  }
  return `$${num.toFixed(decimals)}`
}

function formatSupply(value: string | null): string {
  if (value === null || value === undefined) return 'N/A'
  const num = parseFloat(value)
  if (isNaN(num)) return 'N/A'

  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(2)}T`
  }
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`
  }
  return num.toLocaleString()
}

function formatPercentage(value: number | null): { text: string; color: string; icon: React.ReactElement | null } {
  if (value === null || value === undefined || isNaN(value)) {
    return { text: 'N/A', color: 'text-muted-foreground', icon: null }
  }

  const isPositive = value >= 0
  const text = `${isPositive ? '+' : ''}${value.toFixed(2)}%`
  const color = isPositive ? 'text-green-500' : 'text-red-500'
  const icon = isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />

  return { text, color, icon }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return 'N/A'
  }
}

export function GetAssetDetailsUI({ toolPart }: GetAssetDetailsUIProps) {
  const { state, output, input } = toolPart
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

  const assetData = output as { asset: AssetWithMarketData | null } | undefined
  const asset = assetData?.asset
  const searchTerm = (input as { searchTerm?: string })?.searchTerm

  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>Fetching detailed market data for {searchTerm || 'asset'}</StatusText.Loading>
  }

  if (state === 'output-error' || !asset) {
    return <StatusText.Error>Failed to fetch asset details for {searchTerm || 'asset'} ❌</StatusText.Error>
  }

  const priceChange24h = formatPercentage(asset.priceChange24h)
  const priceChange7d = formatPercentage(asset.priceChange7d)
  const priceChange30d = formatPercentage(asset.priceChange30d)

  const description = asset.description || 'No description available for this asset.'
  const shouldTruncate = description.length > 200
  const displayDescription = descriptionExpanded || !shouldTruncate ? description : `${description.slice(0, 200)}...`

  const hasScores = asset.coingeckoScore || asset.communityScore || asset.developerScore || asset.liquidityScore
  const hasSentiment = asset.sentimentVotesUpPercentage !== null || asset.sentimentVotesDownPercentage !== null

  return (
    <TxStepCard.Root className="min-w-full">
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="flex items-center gap-3">
            {asset.icon && <img src={asset.icon} alt={asset.symbol} className="w-12 h-12 rounded-full" />}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{asset.name}</span>
                <span className="text-sm text-muted-foreground font-normal">{asset.symbol.toUpperCase()}</span>
              </div>
              {asset.marketCapRank && (
                <span className="text-xs text-muted-foreground font-normal">Rank #{asset.marketCapRank}</span>
              )}
            </div>
          </div>
        </TxStepCard.HeaderRow>

        <TxStepCard.HeaderRow className="mt-2">
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold">${parseFloat(asset.price).toFixed(asset.precision > 2 ? 6 : 2)}</span>
            <div className={`flex items-center gap-1 ${priceChange24h.color}`}>
              {priceChange24h.icon}
              <span className="text-sm font-medium">{priceChange24h.text}</span>
              <span className="text-xs text-muted-foreground font-normal">24h</span>
            </div>
          </div>
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      <TxStepCard.Content>
        <TxStepCard.Details>
          <div className="grid grid-cols-2 gap-4">
            <TxStepCard.DetailItem
              label="Market Cap"
              value={asset.marketCap ? formatNumber(asset.marketCap) : <Skeleton className="h-4 w-20" />}
            />
            <TxStepCard.DetailItem
              label="24h Volume"
              value={asset.volume24h ? formatNumber(asset.volume24h) : <Skeleton className="h-4 w-20" />}
            />
            <TxStepCard.DetailItem
              label="FDV"
              value={asset.fdv ? formatNumber(asset.fdv) : <Skeleton className="h-4 w-20" />}
            />
            <TxStepCard.DetailItem
              label="Network"
              value={asset.network.charAt(0).toUpperCase() + asset.network.slice(1)}
            />
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-medium mb-3">Price Changes</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-normal">24h</span>
                <span className={`font-medium ${priceChange24h.color}`}>{priceChange24h.text}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-normal">7d</span>
                <span className={`font-medium ${priceChange7d.color}`}>{priceChange7d.text}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-normal">30d</span>
                <span className={`font-medium ${priceChange30d.color}`}>{priceChange30d.text}</span>
              </div>
            </div>
          </div>

          {(asset.ath || asset.atl) && (
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-medium mb-3">All-Time High/Low</h3>
              <div className="space-y-2">
                {asset.ath && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-normal">ATH</span>
                    <div className="flex flex-col items-end">
                      <span className="font-medium">${asset.ath.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground font-normal">{formatDate(asset.athDate)}</span>
                    </div>
                  </div>
                )}
                {asset.atl && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-normal">ATL</span>
                    <div className="flex flex-col items-end">
                      <span className="font-medium">${asset.atl.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground font-normal">{formatDate(asset.atlDate)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-medium mb-3">Supply Information</h3>
            <div className="space-y-2">
              {asset.circulatingSupply && (
                <TxStepCard.DetailItem label="Circulating Supply" value={formatSupply(asset.circulatingSupply)} />
              )}
              {asset.totalSupply && (
                <TxStepCard.DetailItem label="Total Supply" value={formatSupply(asset.totalSupply)} />
              )}
              {asset.maxSupply ? (
                <TxStepCard.DetailItem label="Max Supply" value={formatSupply(asset.maxSupply)} />
              ) : (
                <TxStepCard.DetailItem label="Max Supply" value="Unlimited" />
              )}
            </div>
          </div>

          {hasSentiment && (
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-medium mb-3">Sentiment</h3>
              <div className="space-y-2">
                {asset.sentimentVotesUpPercentage !== null && asset.sentimentVotesDownPercentage !== null && (
                  <>
                    <div className="flex gap-2 h-2 rounded-full overflow-hidden bg-muted">
                      <div className="bg-green-500" style={{ width: `${asset.sentimentVotesUpPercentage}%` }} />
                      <div className="bg-red-500" style={{ width: `${asset.sentimentVotesDownPercentage}%` }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-500 font-medium">
                        {asset.sentimentVotesUpPercentage.toFixed(1)}% Bullish
                      </span>
                      <span className="text-red-500 font-medium">
                        {asset.sentimentVotesDownPercentage.toFixed(1)}% Bearish
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {hasScores && (
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-medium mb-3">Scores</h3>
              <div className="space-y-2">
                {asset.coingeckoScore !== null && (
                  <TxStepCard.DetailItem label="CoinGecko Score" value={asset.coingeckoScore.toFixed(1)} />
                )}
                {asset.communityScore !== null && (
                  <TxStepCard.DetailItem label="Community Score" value={asset.communityScore.toFixed(1)} />
                )}
                {asset.developerScore !== null && (
                  <TxStepCard.DetailItem label="Developer Score" value={asset.developerScore.toFixed(1)} />
                )}
                {asset.liquidityScore !== null && (
                  <TxStepCard.DetailItem label="Liquidity Score" value={asset.liquidityScore.toFixed(1)} />
                )}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-medium mb-2">About {asset.symbol.toUpperCase()}</h3>
            <p className="text-muted-foreground font-normal text-sm leading-relaxed whitespace-pre-wrap">
              {displayDescription}
            </p>
            {shouldTruncate && (
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="text-sm text-purple-500 hover:text-purple-400 mt-2 font-medium"
              >
                {descriptionExpanded ? 'Show less' : 'More...'}
              </button>
            )}
          </div>
        </TxStepCard.Details>
      </TxStepCard.Content>
    </TxStepCard.Root>
  )
}
