import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
import { useSafeAccount } from '@/hooks/useSafeAccount'
import { useVaultBalances } from '@/hooks/useVaultBalances'
import { bnOrZero } from '@/lib/bignumber'
import { SUPPORTED_EVM_CHAINS } from '@/lib/chains'
import { getSafeAppUrl } from '@/lib/explorers'
import { cn } from '@/lib/utils'

type PortfolioHeaderProps = {
  isVaultMode: boolean
}

type DeployedChain = {
  chainId: number
  networkName: string
  vanityName: string
  iconUrl: string
  safeUrl: string
}

export function PortfolioHeader({ isVaultMode }: PortfolioHeaderProps) {
  const {
    totalBalance: walletBalance,
    delta24h,
    isLoading: isWalletLoading,
    isFetching: isWalletFetching,
  } = usePortfolioQuery()
  const { totalBalance: vaultBalance, isLoading: isVaultLoading, isFetching: isVaultFetching } = useVaultBalances()
  const { safeAddress, isDeployed, deployedChainIds, safeDeploymentState } = useSafeAccount()

  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })

  const handleCopyAddress = () => {
    if (!safeAddress) return
    copyToClipboard(safeAddress)
    toast.success('Address copied')
  }

  const deployedChains: DeployedChain[] = useMemo(() => {
    return deployedChainIds
      .map(chainId => {
        const chainSafeAddress = safeDeploymentState[chainId]?.safeAddress
        if (!chainSafeAddress) return null
        const chainConfig = SUPPORTED_EVM_CHAINS.find(c => c.chain.id === chainId)
        if (!chainConfig) return null
        return {
          chainId,
          networkName: chainConfig.networkName,
          vanityName: chainConfig.vanityName,
          iconUrl: chainConfig.iconUrl,
          safeUrl: getSafeAppUrl(chainConfig.networkName, chainSafeAddress),
        }
      })
      .filter((c): c is DeployedChain => c !== null)
  }, [deployedChainIds, safeDeploymentState])

  const isLoading = isVaultMode ? isVaultLoading : isWalletLoading
  const isFetching = isVaultMode ? isVaultFetching : isWalletFetching
  const displayBalance = isVaultMode ? vaultBalance : walletBalance

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-6 px-4 space-y-2">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-3.5 w-32" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-6 px-4">
      <div className="flex items-center gap-2 text-[40px] font-semibold tracking-tight text-foreground">
        <Amount.Fiat value={displayBalance} />
        {isFetching && !isLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {!isVaultMode && delta24h && (
        <span
          className={cn(
            'text-xs mt-1',
            bnOrZero(delta24h.percentage).gt(0) && 'text-green-500',
            bnOrZero(delta24h.percentage).lt(0) && 'text-red-500'
          )}
        >
          <Amount.Fiat value={delta24h.fiatAmount} /> (<Amount.Percent value={delta24h.percentage} />)
        </span>
      )}

      {isVaultMode && safeAddress && isDeployed && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-mono">
              {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
            </span>
            <button
              onClick={handleCopyAddress}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          {deployedChains.length > 0 && (
            <div className="flex items-center gap-1.5">
              {deployedChains.map(chain => (
                <a
                  key={chain.chainId}
                  href={chain.safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-whiteAlpha-100 hover:bg-whiteAlpha-200 transition-colors px-2 py-0.5"
                >
                  <img src={chain.iconUrl} alt={chain.vanityName} className="w-3.5 h-3.5 rounded-full" />
                  <span className="text-[10px] font-medium text-muted-foreground">{chain.vanityName}</span>
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {isVaultMode && (!safeAddress || !isDeployed) && (
        <span className="text-xs text-muted-foreground mt-1">Vault activates with your first automated order</span>
      )}
    </div>
  )
}
