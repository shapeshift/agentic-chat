import type { TrimmedGainerLoserCoin } from '@shapeshiftoss/agentic-server'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { AssetListItem } from '../ui/AssetListItem'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

type GainerLoserCardProps = {
  items: TrimmedGainerLoserCoin[]
  title: string
  icon: ReactNode
  variant: 'gain' | 'loss'
}

function GainerLoserCard({ items, title, icon, variant }: GainerLoserCardProps) {
  if (items.length === 0) return null

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium">{title}</span>
          </div>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <div className="divide-y divide-border">
            {items.map((coin, index) => (
              <AssetListItem
                key={coin.id}
                name={coin.name}
                symbol={coin.symbol}
                assetId={coin.assetId}
                price={coin.price}
                priceChange24h={coin.priceChange24h}
                rank={index + 1}
                variant={variant}
              />
            ))}
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}

export function TopGainersLosersUI({ toolPart }: ToolUIComponentProps<'getTopGainersLosersTool'>) {
  const { state, output } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: 'Fetching top gainers and losers...',
    error: 'Failed to fetch market movers',
  })

  if (stateRender) return stateRender

  if (!output || (output.gainers.length === 0 && output.losers.length === 0)) {
    return null
  }

  const { gainers, losers, duration } = output

  return (
    <div className="space-y-3">
      <GainerLoserCard
        items={gainers}
        title={`Top Gainers (${duration})`}
        icon={<TrendingUp className="w-5 h-5 text-green-500" />}
        variant="gain"
      />
      <GainerLoserCard
        items={losers}
        title={`Top Losers (${duration})`}
        icon={<TrendingDown className="w-5 h-5 text-red-500" />}
        variant="loss"
      />
    </div>
  )
}
