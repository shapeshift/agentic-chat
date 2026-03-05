import { Vault } from 'lucide-react'

import { Skeleton } from '@/components/ui/Skeleton'
import { useSafeAccount } from '@/hooks/useSafeAccount'
import { useVaultBalances } from '@/hooks/useVaultBalances'
import { useVaultOrders } from '@/hooks/useVaultOrders'
import type { VaultOrder } from '@/hooks/useVaultOrders'
import { cn } from '@/lib/utils'

import { DrawerListItem } from '../ui/DrawerListItem'

import { PortfolioAssetRow } from './PortfolioAssetRow'

const ORDER_STATUS_STYLES: Record<string, string> = {
  open: 'text-blue-500',
  submitted: 'text-orange-500',
  fulfilled: 'text-green-500',
  cancelled: 'text-red-500',
  expired: 'text-muted-foreground',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  open: 'Active',
  submitted: 'Submitted',
  fulfilled: 'Filled',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

function VaultOrderRow({ order }: { order: VaultOrder }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">
            {order.sellToken.slice(0, 6)}...{order.sellToken.slice(-4)}
          </span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="font-medium">
            {order.buyToken.slice(0, 6)}...{order.buyToken.slice(-4)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
      </div>
      <span className={cn('text-xs font-medium', ORDER_STATUS_STYLES[order.status] ?? 'text-muted-foreground')}>
        {ORDER_STATUS_LABELS[order.status] ?? order.status}
      </span>
    </div>
  )
}

function VaultLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function VaultAssetList() {
  const { safeAddress, isDeployed } = useSafeAccount()
  const { balances, isLoading: isLoadingBalances } = useVaultBalances()
  const { activeOrders, isLoading: isLoadingOrders } = useVaultOrders()

  if (!safeAddress || !isDeployed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Vault className="w-12 h-12 text-muted-foreground mb-3" />
        <div className="text-sm font-medium text-foreground">No vault yet</div>
        <div className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
          Your vault activates automatically when you create your first stop-loss or TWAP order.
        </div>
      </div>
    )
  }

  if (isLoadingBalances || isLoadingOrders) {
    return <VaultLoadingSkeleton />
  }

  if (balances.length === 0 && activeOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Vault className="w-10 h-10 text-muted-foreground mb-3" />
        <div className="text-sm font-medium text-foreground">Vault is empty</div>
        <div className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
          Tokens are deposited here automatically when you create automated orders.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {balances.map(asset => (
        <div key={asset.assetId} className="px-4 mb-2">
          <DrawerListItem>
            <PortfolioAssetRow asset={asset} showNetwork />
          </DrawerListItem>
        </div>
      ))}

      {activeOrders.length > 0 && (
        <div className="mt-2">
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Orders ({activeOrders.length})
          </div>
          <div className="divide-y divide-border">
            {activeOrders.map(order => (
              <VaultOrderRow key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
