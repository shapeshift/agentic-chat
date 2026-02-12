import { Copy, ExternalLink, Vault } from 'lucide-react'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { AssetIcon } from '@/components/ui/AssetIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { useSafeAccount } from '@/hooks/useSafeAccount'
import { useVaultBalances } from '@/hooks/useVaultBalances'
import { useVaultOrders } from '@/hooks/useVaultOrders'
import type { VaultOrder } from '@/hooks/useVaultOrders'
import { getSafeAppUrl } from '@/lib/explorers'
import { cn } from '@/lib/utils'
import type { PortfolioAsset } from '@/types/portfolio'

function VaultHeader({ safeAddress, totalBalance }: { safeAddress: string; totalBalance: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(safeAddress).catch(console.error)
    toast.success('Address copied')
  }, [safeAddress])

  return (
    <div className="flex flex-col items-center py-6 px-4">
      <div className="text-[40px] font-semibold tracking-tight text-foreground">
        <Amount.Fiat value={totalBalance} />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-muted-foreground font-mono">
          {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
        </span>
        <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
          <Copy className="h-3 w-3" />
        </button>
        <a
          href={getSafeAppUrl('ethereum', safeAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

function VaultAssetRow({ asset }: { asset: PortfolioAsset }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <AssetIcon assetId={asset.assetId} className="w-10 h-10" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm text-foreground">{asset.symbol}</span>
        <div className="text-sm text-muted-foreground">
          <Amount.Crypto value={asset.cryptoBalancePrecision} symbol={asset.symbol} decimals={6} />
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-foreground">
          <Amount.Fiat value={asset.fiatAmount} />
        </div>
      </div>
    </div>
  )
}

const ORDER_STATUS_STYLES: Record<string, string> = {
  open: 'text-blue-500',
  fulfilled: 'text-green-500',
  cancelled: 'text-red-500',
  expired: 'text-muted-foreground',
  presignaturePending: 'text-yellow-500',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  open: 'Active',
  fulfilled: 'Filled',
  cancelled: 'Cancelled',
  expired: 'Expired',
  presignaturePending: 'Pending',
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

function EmptyVaultState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Vault className="w-12 h-12 text-muted-foreground mb-3" />
      <div className="text-lg font-medium text-foreground">Automation Vault</div>
      <div className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
        Your vault will be created automatically when you set up your first automated order.
      </div>
    </div>
  )
}

function VaultLoadingSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center py-6 px-4 space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
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
    </div>
  )
}

export function VaultPanel() {
  const { safeAddress, isDeployed } = useSafeAccount()
  const { balances, totalBalance, isLoading: isLoadingBalances } = useVaultBalances()
  const { activeOrders, isLoading: isLoadingOrders } = useVaultOrders()

  if (!safeAddress || !isDeployed) {
    return <EmptyVaultState />
  }

  if (isLoadingBalances || isLoadingOrders) {
    return <VaultLoadingSkeleton />
  }

  return (
    <div className="flex flex-col">
      <VaultHeader safeAddress={safeAddress} totalBalance={totalBalance} />

      {balances.length > 0 && (
        <div className="divide-y divide-border">
          {balances.map(asset => (
            <VaultAssetRow key={asset.assetId} asset={asset} />
          ))}
        </div>
      )}

      {balances.length === 0 && (
        <div className="text-center py-8 px-4">
          <div className="text-sm text-muted-foreground">No tokens in vault</div>
          <div className="text-xs text-muted-foreground mt-1">Deposit tokens to start automating your trades.</div>
        </div>
      )}

      {activeOrders.length > 0 && (
        <div className="mt-4">
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
