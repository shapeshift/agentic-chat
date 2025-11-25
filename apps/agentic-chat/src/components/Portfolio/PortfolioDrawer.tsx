import { useAppKit, useAppKitAccount, useDisconnect, useWalletInfo } from '@reown/appkit/react'
import { Power, Wallet, X } from 'lucide-react'
import { useState } from 'react'

import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
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
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { Sheet, SheetClose, SheetContent } from '../ui/sheet'

import { PortfolioPanel } from './PortfolioPanel'

type PortfolioDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

export function PortfolioDrawer({ isOpen, onClose }: PortfolioDrawerProps) {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { disconnect } = useDisconnect()
  const { walletInfo } = useWalletInfo()
  const [showDisconnectAlert, setShowDisconnectAlert] = useState(false)
  const { isError, error, refetch } = usePortfolioQuery()

  const handleDisconnect = () => {
    void disconnect().then(() => {
      setShowDisconnectAlert(false)
      onClose()
    })
  }

  const handleConnect = () => {
    void open()
  }

  const truncatedAddress = address ? truncateAddress(address) : ''

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 [&>button]:hidden">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            {isConnected && (
              <div className="flex items-center gap-2">
                {walletInfo?.icon && (
                  <img src={walletInfo.icon} alt={walletInfo.name || 'Wallet'} className="w-6 h-6 rounded-full" />
                )}
                <span className="text-sm font-medium">{truncatedAddress}</span>
              </div>
            )}
            {!isConnected && <div />}
            <div className="flex items-center gap-2">
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
                <Button onClick={handleConnect} variant="default" className="mt-4">
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
    </Sheet>
  )
}
