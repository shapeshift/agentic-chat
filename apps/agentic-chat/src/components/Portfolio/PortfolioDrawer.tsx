import { useDynamicContext, useDynamicModals, useSwitchWallet, useUserWallets } from '@dynamic-labs/sdk-react-core'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, Power, Wallet, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
import { filterEvmWallets, filterSolanaWallets, useWalletConnection } from '@/hooks/useWalletConnection'
import { truncateAddress } from '@/lib/utils'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/AlertDialog'
import { Button } from '../ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu'
import { Sheet, SheetClose, SheetContent } from '../ui/Sheet'

import { NetworkWalletRow } from './NetworkWalletRow'
import { PortfolioPanel } from './PortfolioPanel'

type PortfolioDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

export function PortfolioDrawer({ isOpen, onClose }: PortfolioDrawerProps) {
  const { setShowAuthFlow, handleLogOut, primaryWallet, removeWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()
  const { setShowLinkNewWalletModal } = useDynamicModals()
  const userWallets = useUserWallets()
  const { isConnected, evmAddress, solanaAddress } = useWalletConnection()
  const [showDisconnectAlert, setShowDisconnectAlert] = useState(false)
  const [walletToDisconnect, setWalletToDisconnect] = useState<string | null>(null)
  const { isError, error, refetch } = usePortfolioQuery()
  const queryClient = useQueryClient()

  const handleDisconnect = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['portfolio'] }).catch(console.error)
    queryClient.invalidateQueries({ queryKey: ['approvedChains'] }).catch(console.error)

    handleLogOut()
      .catch(error => {
        console.error('Failed to disconnect wallet:', error)
      })
      .finally(() => {
        setShowDisconnectAlert(false)
        onClose()
      })
  }, [queryClient, handleLogOut, onClose])

  const handleWalletDisconnect = useCallback(() => {
    if (walletToDisconnect) {
      removeWallet(walletToDisconnect).catch(console.error)
      setWalletToDisconnect(null)
    }
  }, [walletToDisconnect, removeWallet])

  const handleConnectWallet = useCallback(() => {
    setShowAuthFlow(true)
  }, [setShowAuthFlow])

  const handleAddWallet = useCallback(() => {
    onClose()
    setShowLinkNewWalletModal(true)
  }, [onClose, setShowLinkNewWalletModal])

  const displayAddress = useMemo(
    () => primaryWallet?.address ?? evmAddress ?? solanaAddress,
    [primaryWallet?.address, evmAddress, solanaAddress]
  )
  const truncatedAddress = useMemo(() => (displayAddress ? truncateAddress(displayAddress) : ''), [displayAddress])

  const primaryWalletIcon = primaryWallet?.connector?.metadata?.icon

  const evmWallets = useMemo(() => filterEvmWallets(userWallets), [userWallets])
  const solanaWallets = useMemo(() => filterSolanaWallets(userWallets), [userWallets])

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 [&>button]:hidden">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            {isConnected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                    {primaryWalletIcon && <img src={primaryWalletIcon} alt="Wallet" className="w-6 h-6 rounded-full" />}
                    <span className="text-sm font-medium">{truncatedAddress}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-80 max-h-[500px] overflow-y-auto">
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Connected Wallets</div>

                  {evmWallets.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                        EVM
                      </div>
                      {evmWallets.map(wallet => (
                        <div key={wallet.id} className="relative">
                          <NetworkWalletRow
                            label={wallet.connector.name}
                            address={wallet.address}
                            icon={wallet.connector?.metadata?.icon}
                            isActive={wallet.id === primaryWallet?.id}
                            onConnect={() => {
                              if (wallet.id !== primaryWallet?.id) {
                                changePrimaryWallet(wallet.id).catch(console.error)
                              }
                            }}
                            onDisconnect={() => setWalletToDisconnect(wallet.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {solanaWallets.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                        Solana
                      </div>
                      {solanaWallets.map(wallet => (
                        <div key={wallet.id} className="relative">
                          <NetworkWalletRow
                            label={wallet.connector.name}
                            address={wallet.address}
                            icon={wallet.connector?.metadata?.icon}
                            isActive={wallet.id === primaryWallet?.id}
                            onConnect={() => {
                              if (wallet.id !== primaryWallet?.id) {
                                changePrimaryWallet(wallet.id).catch(console.error)
                              }
                            }}
                            onDisconnect={() => setWalletToDisconnect(wallet.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <DropdownMenuSeparator />
                  <Button variant="ghost" className="w-full justify-start gap-2 px-2" onClick={handleAddWallet}>
                    <Plus className="w-4 h-4" />
                    <span>Connect another wallet</span>
                  </Button>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {isConnected && (
                <Button variant="ghost" size="icon" onClick={() => setShowDisconnectAlert(true)} className="h-8 w-8">
                  <Power className="w-4 h-4" />
                </Button>
              )}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </SheetClose>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {!isConnected && (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
                <div className="text-lg font-medium text-foreground">No wallet connected</div>
                <div className="text-sm text-muted-foreground mt-1">Connect a wallet to view your portfolio</div>
                <Button onClick={handleConnectWallet} variant="default" className="mt-4">
                  Connect Wallet
                </Button>
              </div>
            )}
            {isConnected && isError && (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <div className="text-center">
                  <div className="text-lg font-medium text-destructive">Failed to load portfolio</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {error instanceof Error ? error.message : 'An error occurred'}
                  </div>
                  <Button onClick={() => void refetch()} variant="default" className="mt-4">
                    Retry
                  </Button>
                </div>
              </div>
            )}
            {isConnected && !isError && <PortfolioPanel />}
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={showDisconnectAlert} onOpenChange={setShowDisconnectAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect your wallet? You will need to reconnect to view your portfolio and
              perform transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!walletToDisconnect} onOpenChange={open => !open && setWalletToDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Wallet</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to disconnect this wallet?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWalletDisconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
