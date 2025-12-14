import { formatDistanceToNow } from 'date-fns'
import { ArrowRightLeft, Send, Timer } from 'lucide-react'

import { DrawerListItem } from '@/components/ui/DrawerListItem'
import { ToolCard } from '@/components/ui/ToolCard'
import { stopPropagationHandler } from '@/lib/eventHandlers'
import { getExplorerUrl } from '@/lib/explorers'
import { formatCryptoAmount } from '@/lib/number'
import { truncateAddress } from '@/lib/utils'
import type { ActivityItem } from '@/types/activity'

import { LimitOrderDetails } from './components/LimitOrderDetails'
import { SendDetails } from './components/SendDetails'
import { SwapDetails } from './components/SwapDetails'

type ActivityRowProps = {
  activity: ActivityItem
}

const ACTIVITY_ICONS = {
  swap: ArrowRightLeft,
  send: Send,
  limit_order: Timer,
}

function formatActivityTitle(activity: ActivityItem): string {
  switch (activity.type) {
    case 'swap':
      return `Swapped ${formatCryptoAmount(activity.details.sellAsset.amount, { symbol: activity.details.sellAsset.symbol })} to ${formatCryptoAmount(activity.details.buyAsset.amount, { symbol: activity.details.buyAsset.symbol })}`
    case 'send':
      return `Sent ${formatCryptoAmount(activity.details.asset.amount, { symbol: activity.details.asset.symbol })}`
    case 'limit_order':
      return `Limit order: ${formatCryptoAmount(activity.details.sellAsset.amount, { symbol: activity.details.sellAsset.symbol })} → ${formatCryptoAmount(activity.details.buyAsset.estimatedAmount, { symbol: activity.details.buyAsset.symbol })}`
  }
}

function ActivityDetails({ activity }: { activity: ActivityItem }) {
  const txHash = activity.type !== 'limit_order' ? activity.txHash : undefined
  const explorerUrl = txHash ? getExplorerUrl(activity.network, txHash) : undefined

  return (
    <ToolCard.Details>
      {explorerUrl && txHash && (
        <ToolCard.DetailItem
          label="TX ID"
          value={
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-blue-500 hover:text-blue-400 transition-colors"
              onClick={stopPropagationHandler}
            >
              {truncateAddress(txHash, 8, 6)}
            </a>
          }
        />
      )}
      {activity.type === 'swap' && <SwapDetails details={activity.details} network={activity.network} />}
      {activity.type === 'send' && <SendDetails details={activity.details} />}
      {activity.type === 'limit_order' && <LimitOrderDetails details={activity.details} />}
    </ToolCard.Details>
  )
}

export function ActivityRow({ activity }: ActivityRowProps) {
  const Icon = ACTIVITY_ICONS[activity.type]

  return (
    <DrawerListItem expandedChildren={<ActivityDetails activity={activity} />}>
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground truncate">{formatActivityTitle(activity)}</div>
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
        </div>
      </div>
    </DrawerListItem>
  )
}
