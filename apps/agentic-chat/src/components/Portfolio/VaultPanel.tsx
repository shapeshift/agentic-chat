import { Vault } from 'lucide-react'

import { useSafeAccount } from '@/hooks/useSafeAccount'
import { useVaultBalances } from '@/hooks/useVaultBalances'

import { DrawerListItem } from '../ui/DrawerListItem'

import { AssetListSkeleton } from './PortfolioAssetList'
import { PortfolioAssetRow } from './PortfolioAssetRow'

export function VaultAssetList() {
  const { safeAddress, isDeployed } = useSafeAccount()
  const { balances, isLoading } = useVaultBalances()

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

  if (isLoading) {
    return <AssetListSkeleton rows={3} />
  }

  if (balances.length === 0) {
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
    </div>
  )
}
