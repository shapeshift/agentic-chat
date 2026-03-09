import { Flame } from 'lucide-react'

import { AssetListItem } from '../ui/AssetListItem'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function TrendingTokensUI({ toolPart }: ToolUIComponentProps<'getTrendingTokensTool'>) {
  const { state, output } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: 'Fetching trending tokens...',
    error: 'Failed to fetch trending tokens',
  })

  if (stateRender) return stateRender

  const tokens = output?.tokens

  if (!tokens || tokens.length === 0) {
    return null
  }

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-medium">Trending on CoinGecko (24h)</span>
          </div>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <div className="divide-y divide-border">
            {tokens.map((token, index) => (
              <AssetListItem
                key={token.id}
                name={token.name}
                symbol={token.symbol}
                icon={token.icon}
                price={token.price}
                priceChange24h={token.priceChange24h}
                rank={index + 1}
              />
            ))}
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
