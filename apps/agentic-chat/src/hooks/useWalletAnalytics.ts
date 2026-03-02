import { useEffect, useRef } from 'react'

import { analytics } from '@/lib/mixpanel'

import { useWalletConnection } from './useWalletConnection'

export function useWalletAnalytics() {
  const { evmAddress, solanaAddress } = useWalletConnection()
  const prevEvmAddress = useRef<string | undefined>(undefined)
  const prevSolanaAddress = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (evmAddress && evmAddress !== prevEvmAddress.current) {
      analytics.identify(evmAddress, { walletType: 'evm' })
      analytics.trackWalletConnect({ address: evmAddress, walletType: 'evm' })
    }
    prevEvmAddress.current = evmAddress
  }, [evmAddress])

  useEffect(() => {
    if (solanaAddress && solanaAddress !== prevSolanaAddress.current) {
      analytics.identify(solanaAddress, { walletType: 'solana' })
      analytics.trackWalletConnect({ address: solanaAddress, walletType: 'solana' })
    }
    prevSolanaAddress.current = solanaAddress
  }, [solanaAddress])

  useEffect(() => {
    // Reset analytics when both wallets disconnect
    if (!evmAddress && !solanaAddress && (prevEvmAddress.current || prevSolanaAddress.current)) {
      analytics.reset()
    }
  }, [evmAddress, solanaAddress])
}
