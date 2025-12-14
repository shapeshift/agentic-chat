import { Amount } from '@/components/ui/Amount'
import { ToolCard } from '@/components/ui/ToolCard'
import { stopPropagationHandler } from '@/lib/eventHandlers'
import { getExplorerUrl } from '@/lib/explorers'
import { truncateAddress } from '@/lib/utils'
import type { SwapActivityDetails } from '@/types/activity'

type SwapDetailsProps = {
  details: SwapActivityDetails
  network: string
}

export function SwapDetails({ details, network }: SwapDetailsProps) {
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
              onClick={stopPropagationHandler}
            >
              {truncateAddress(details.approval.txHash, 8, 6)}
            </a>
          }
        />
      )}
    </>
  )
}
