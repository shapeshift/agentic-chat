import { mainnet, solana } from '@reown/appkit/networks'
import { modal, useAppKit, useAppKitAccount, useDisconnect, useWalletInfo } from '@reown/appkit/react'
import { ChevronDown, Power, Wallet, X } from 'lucide-react'
import { useState } from 'react'

import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
import { useWalletConnection } from '@/hooks/useWalletConnection'
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
  const { open } = useAppKit()
  const { address } = useAppKitAccount()
  const evmAccount = useAppKitAccount({ namespace: 'eip155' })
  const solanaAccount = useAppKitAccount({ namespace: 'solana' })
  const { isConnected } = useWalletConnection()
  const { disconnect } = useDisconnect()
  const { walletInfo } = useWalletInfo()
  const { walletInfo: evmWalletInfo } = useWalletInfo('eip155')
  const { walletInfo: solanaWalletInfo } = useWalletInfo('solana')
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

  const handleConnectEvm = () => {
    void open({ view: 'Connect', namespace: 'eip155' })
  }

  const handleConnectSolana = () => {
    void open({ view: 'Connect', namespace: 'solana' })
  }

  const handleDisconnectEvm = () => {
    const solanaWasConnected = solanaAccount.isConnected
    void disconnect({ namespace: 'eip155' }).then(() => {
      if (solanaWasConnected) {
        void modal?.switchNetwork(solana)
      }
    })
  }

  const handleDisconnectSolana = () => {
    const evmWasConnected = evmAccount.isConnected
    void disconnect({ namespace: 'solana' }).then(() => {
      if (evmWasConnected) {
        void modal?.switchNetwork(mainnet)
      }
    })
  }

  const truncatedAddress = address ? truncateAddress(address) : ''

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 [&>button]:hidden">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            {isConnected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                    {evmAccount.isConnected && solanaAccount.isConnected ? (
                      <div className="relative w-8 h-8">
                        <img
                          src={evmWalletInfo?.icon}
                          alt="EVM Wallet"
                          className="absolute top-0 left-0 w-6 h-6 rounded-full border-2 border-background"
                        />
                        <img
                          src={solanaWalletInfo?.icon}
                          alt="Solana Wallet"
                          className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-background"
                        />
                      </div>
                    ) : (
                      walletInfo?.icon && (
                        <img src={walletInfo.icon} alt={walletInfo.name || 'Wallet'} className="w-6 h-6 rounded-full" />
                      )
                    )}
                    <span className="text-sm font-medium">{truncatedAddress}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-64">
                  <NetworkWalletRow
                    label="EVM"
                    address={evmAccount.address}
                    icon={evmWalletInfo?.icon}
                    isConnected={evmAccount.isConnected}
                    onConnect={handleConnectEvm}
                    onDisconnect={handleDisconnectEvm}
                  />
                  <DropdownMenuSeparator />
                  <NetworkWalletRow
                    label="Solana"
                    address={solanaAccount.address}
                    icon={solanaWalletInfo?.icon}
                    isConnected={solanaAccount.isConnected}
                    onConnect={handleConnectSolana}
                    onDisconnect={handleDisconnectSolana}
                  />
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
