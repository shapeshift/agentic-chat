import { Amount } from '@/components/ui/Amount'
import { ToolCard } from '@/components/ui/ToolCard'
import { truncateAddress } from '@/lib/utils'
import type { SendActivityDetails } from '@/types/activity'

type SendDetailsProps = {
  details: SendActivityDetails
}

export function SendDetails({ details }: SendDetailsProps) {
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
