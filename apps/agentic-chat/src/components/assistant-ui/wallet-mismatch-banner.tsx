import { useThreadListItem } from '@assistant-ui/react'
import { InfoIcon } from 'lucide-react'
import type { FC } from 'react'

import { useThreadStore } from '@/stores/threadStore'

type WalletMismatchBannerProps = {
  currentAddress: string | undefined
}

const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export const WalletMismatchBanner: FC<WalletMismatchBannerProps> = ({ currentAddress }) => {
  const threadListItem = useThreadListItem()
  const threadId = threadListItem.threadId
  const getThreadMetadata = useThreadStore(state => state.getThreadMetadata)

  if (!threadId || !currentAddress) return null

  const metadata = getThreadMetadata(threadId)
  const createdWithWallet = metadata?.createdWithWallet

  if (!createdWithWallet || createdWithWallet === currentAddress) return null

  return (
    <div className="bg-muted/50 border-muted-foreground/20 mx-auto mb-4 flex w-full max-w-[var(--thread-max-width)] items-start gap-3 rounded-lg border p-3">
      <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="text-muted-foreground flex-1 text-sm">
        <p>
          This conversation was started with <span className="font-mono">{formatAddress(createdWithWallet)}</span>
        </p>
        <p className="mt-1">
          You're now connected as <span className="font-mono">{formatAddress(currentAddress)}</span>
        </p>
      </div>
    </div>
  )
}
