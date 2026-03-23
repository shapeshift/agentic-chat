import { TrendingDown, TrendingUp } from 'lucide-react'
import React, { useState } from 'react'

import { bnOrZero } from '@/lib/bignumber'
import { formatCompactNumber, formatFiat } from '@/lib/number'

import { Amount } from '../ui/Amount'
import { AssetIcon } from '../ui/AssetIcon'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

function formatPriceChange(value: number | null): {
  text: string
  color: string
  icon: React.ReactElement | null
} {
  if (value === null || value === undefined || isNaN(value)) {
    return { text: 'N/A', color: 'text-muted-foreground', icon: null }
  }

  const isPositive = value >= 0
  const text = `${isPositive ? '+' : ''}${value.toFixed(2)}%`
  const color = isPositive ? 'text-green-500' : 'text-red-500'
  const icon = isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />

  return { text, color, icon }
}

function StatMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground font-normal">{label}</span>
    </div>
  )
}

export function GetAssetsUI({ toolPart }: ToolUIComponentProps<'getAssetsTool'>) {
  const { state, output, input } = toolPart
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

  const asset = output?.assets?.[0]
  const searchTerm = (input as { searchTerm?: string })?.searchTerm

  const stateRender = useToolStateRender(state, {
    loading: `Searching for ${searchTerm || 'assets'}`,
    error: `Failed to fetch ${searchTerm || 'asset'} ❌`,
  })

  if (stateRender) return stateRender

  if (!asset) {
    return null
  }

  const priceChange24h = formatPriceChange(asset.priceChange24h ?? null)
  const description = asset.description || 'No description available for this asset.'
  const shouldTruncate = description.length > 200
  const displayDescription = descriptionExpanded || !shouldTruncate ? description : `${description.slice(0, 200)}...`

  const hasSentiment = asset.sentimentVotesUpPercentage !== null || asset.sentimentVotesDownPercentage !== null

  const volMcapRatio = (() => {
    if (!asset.volume24h || !asset.marketCap) return null
    const vol = bnOrZero(asset.volume24h)
    const mcap = bnOrZero(asset.marketCap)
    if (vol.isZero() || mcap.isZero()) return null
    return vol.div(mcap).times(100).toFixed(4)
  })()

  return (
    <ToolCard.Root>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-start justify-between w-full">
            <div className="flex items-center gap-3">
              <AssetIcon icon={asset.icon} symbol={asset.symbol} />
              <div className="flex flex-col">
                <span className="text-[20px] font-bold leading-7">{asset.name}</span>
                <span className="text-sm text-muted-foreground font-normal leading-5">
                  {asset.symbol.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[18px] font-bold leading-7">
                <Amount.Fiat value={asset.price} />
              </span>
              <div className="flex items-end gap-1 leading-5">
                <div className={`flex items-center gap-1 ${priceChange24h.color}`}>
                  {priceChange24h.icon}
                  <span className="text-sm font-medium">{priceChange24h.text}</span>
                </div>
                <span className="text-xs text-muted-foreground font-normal">24h</span>
              </div>
            </div>
          </div>
        </ToolCard.HeaderRow>
      </ToolCard.Header>

      <ToolCard.Content>
        <ToolCard.Details>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatMetric label="Volume" value={formatFiat(asset.volume24h)} />
            <StatMetric label="Market Cap" value={formatFiat(asset.marketCap)} />
            <StatMetric label="FDV" value={formatFiat(asset.fdv)} />
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-medium mb-2">About {asset.symbol.toUpperCase()}</h3>
            <p className="text-muted-foreground font-normal text-sm leading-relaxed whitespace-pre-wrap">
              {displayDescription}
            </p>
            {shouldTruncate && (
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="text-sm text-purple-500 hover:text-purple-400 mt-2 font-medium cursor-pointer"
              >
                {descriptionExpanded ? 'Show less' : 'More...'}
              </button>
            )}
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-medium mb-3">Coin Info</h3>
            <div className="space-y-2">
              {asset.circulatingSupply && (
                <ToolCard.DetailItem label="Circulating Supply" value={formatCompactNumber(asset.circulatingSupply)} />
              )}
              {asset.totalSupply && (
                <ToolCard.DetailItem label="Total Supply" value={formatCompactNumber(asset.totalSupply)} />
              )}
              <ToolCard.DetailItem
                label="Max Supply"
                value={asset.maxSupply ? formatCompactNumber(asset.maxSupply) : 'Unlimited'}
              />
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
                        <Amount.Percent value={asset.sentimentVotesUpPercentage} suffix="Bullish" />
                      </span>
                      <span className="text-red-500 font-medium">
                        <Amount.Percent value={asset.sentimentVotesDownPercentage} suffix="Bearish" />
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {asset.marketCapRank && <StatMetric label="Market Cap Rank" value={`#${asset.marketCapRank}`} />}
              <StatMetric label="24h Volume" value={formatFiat(asset.volume24h)} />
              <StatMetric label="Vol/MCap" value={volMcapRatio ? <Amount.Percent value={volMcapRatio} /> : 'N/A'} />
            </div>
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
