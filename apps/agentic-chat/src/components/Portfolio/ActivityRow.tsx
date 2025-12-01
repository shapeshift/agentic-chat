import { formatDistanceToNow } from 'date-fns'
import { ArrowRightLeft, Send } from 'lucide-react'

import { Amount } from '@/components/ui/Amount'
import { DrawerListItem } from '@/components/ui/DrawerListItem'
import { ToolCard } from '@/components/ui/ToolCard'
import { getExplorerUrl } from '@/lib/explorers'
import { formatCryptoAmount } from '@/lib/number'
import { truncateAddress } from '@/lib/utils'
import type { ActivityItem, SwapActivityDetails, SendActivityDetails } from '@/types/activity'

type ActivityRowProps = {
  activity: ActivityItem
}

const ACTIVITY_ICONS = {
  swap: ArrowRightLeft,
  send: Send,
}

function formatActivityTitle(activity: ActivityItem): string {
  switch (activity.type) {
    case 'swap':
      return `Swapped ${formatCryptoAmount(activity.details.sellAsset.amount, { symbol: activity.details.sellAsset.symbol })} to ${formatCryptoAmount(activity.details.buyAsset.amount, { symbol: activity.details.buyAsset.symbol })}`
    case 'send':
      return `Sent ${formatCryptoAmount(activity.details.asset.amount, { symbol: activity.details.asset.symbol })}`
  }
}

function SwapDetails({ details, network }: { details: SwapActivityDetails; network: string }) {
  const approvalExplorerUrl = details.approval ? getExplorerUrl(network, details.approval.txHash) : undefined

  return (
    <>
      <ToolCard.DetailItem
        label="Sold"
        value={
          <Amount.Crypto
            value={details.sellAsset.amount}
            symbol={details.sellAsset.symbol}
            suffix={
              <>
                (<Amount.Fiat value={details.sellAsset.valueUSD} />)
              </>
            }
          />
        }
      />
      <ToolCard.DetailItem
        label="Received"
        value={
          <Amount.Crypto
            value={details.buyAsset.amount}
            symbol={details.buyAsset.symbol}
            suffix={
              <>
                (<Amount.Fiat value={details.buyAsset.valueUSD} />)
              </>
            }
          />
        }
      />
      <ToolCard.DetailItem label="DEX" value={details.dex} />
      {details.fee && <ToolCard.DetailItem label="Fee" value={<Amount.Fiat value={details.fee} />} />}
      {details.approval && approvalExplorerUrl && (
        <ToolCard.DetailItem
          label="Approval TX"
          value={
            <a
              href={approvalExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-blue-500 hover:text-blue-400 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              {truncateAddress(details.approval.txHash, 8, 6)}
            </a>
          }
        />
      )}
    </>
  )
}

function SendDetails({ details }: { details: SendActivityDetails }) {
  return (
    <>
      <ToolCard.DetailItem
        label="Amount"
        value={<Amount.Crypto value={details.asset.amount} symbol={details.asset.symbol} />}
      />
      <ToolCard.DetailItem label="From" value={truncateAddress(details.from)} />
      <ToolCard.DetailItem label="To" value={truncateAddress(details.to)} />
      {details.fee && (
        <ToolCard.DetailItem label="Fee" value={<Amount.Crypto value={details.fee} symbol={details.feeSymbol} />} />
      )}
    </>
  )
}

function ActivityDetails({ activity }: { activity: ActivityItem }) {
  const explorerUrl = getExplorerUrl(activity.network, activity.txHash)

  return (
    <ToolCard.Details>
      {explorerUrl && (
        <ToolCard.DetailItem
          label="TX ID"
          value={
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-blue-500 hover:text-blue-400 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              {truncateAddress(activity.txHash, 8, 6)}
            </a>
          }
        />
      )}
      {activity.type === 'swap' && <SwapDetails details={activity.details} network={activity.network} />}
      {activity.type === 'send' && <SendDetails details={activity.details} />}
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
