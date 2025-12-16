import { Amount } from '@/components/ui/Amount'
import { ToolCard } from '@/components/ui/ToolCard'
import { stopPropagationHandler } from '@/lib/eventHandlers'
import type { LimitOrderActivityDetails } from '@/types/activity'

type LimitOrderDetailsProps = {
  details: LimitOrderActivityDetails
}

export function LimitOrderDetails({ details }: LimitOrderDetailsProps) {
  return (
    <>
      <ToolCard.DetailItem
        label="Sell"
        value={<Amount.Crypto value={details.sellAsset.amount} symbol={details.sellAsset.symbol} />}
      />
      <ToolCard.DetailItem
        label="Buy (estimated)"
        value={<Amount.Crypto value={details.buyAsset.estimatedAmount} symbol={details.buyAsset.symbol} />}
      />
      <ToolCard.DetailItem
        label="Limit Price"
        value={`1 ${details.sellAsset.symbol} = ${details.limitPrice} ${details.buyAsset.symbol}`}
      />
      <ToolCard.DetailItem label="Expires" value={new Date(details.expiresAt).toLocaleString()} />
      <ToolCard.DetailItem label="Provider" value={details.provider.toUpperCase()} />
      <ToolCard.DetailItem
        label="Track Order"
        value={
          <a
            href={details.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
            onClick={stopPropagationHandler}
          >
            View on CoW Explorer
          </a>
        }
      />
    </>
  )
}
