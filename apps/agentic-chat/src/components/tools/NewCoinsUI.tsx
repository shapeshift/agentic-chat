import { Sparkles } from 'lucide-react'

import { AssetListItem } from '../ui/AssetListItem'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function NewCoinsUI({ toolPart }: ToolUIComponentProps<'getNewCoinsTool'>) {
  const { state, output } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: 'Fetching new coin listings...',
    error: 'Failed to fetch new coins',
  })

  if (stateRender) return stateRender

  const coins = output?.coins

  if (!coins || coins.length === 0) {
    return null
  }

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span className="font-medium">Recently Added on CoinGecko</span>
          </div>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <div className="divide-y divide-border">
            {coins.map((coin, index) => (
              <AssetListItem
                key={coin.id}
                name={coin.name}
                symbol={coin.symbol}
                icon={coin.icon}
                rank={index + 1}
                subtitle={`Listed ${coin.activatedAtFormatted}`}
              />
            ))}
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
