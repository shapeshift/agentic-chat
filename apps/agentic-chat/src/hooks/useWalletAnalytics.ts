import { useEffect, useRef } from 'react'

import { analytics } from '@/lib/mixpanel'

import { useWalletConnection } from './useWalletConnection'

export function useWalletAnalytics() {
  const { evmAddress, solanaAddress, hasEmbeddedWallet } = useWalletConnection()
  const prevEvmAddress = useRef<string | undefined>(undefined)
  const prevSolanaAddress = useRef<string | undefined>(undefined)

  useEffect(() => {
    const walletCategory = hasEmbeddedWallet ? 'embedded' : 'external'
    // Track EVM wallet connection
    if (evmAddress && evmAddress !== prevEvmAddress.current) {
      analytics.identify(evmAddress, { walletType: 'evm', walletCategory })
      analytics.trackWalletConnect({ address: evmAddress, walletType: 'evm', walletCategory })
    }
    prevEvmAddress.current = evmAddress
  }, [evmAddress, hasEmbeddedWallet])

  useEffect(() => {
    const walletCategory = hasEmbeddedWallet ? 'embedded' : 'external'
    // Track Solana wallet connection
    if (solanaAddress && solanaAddress !== prevSolanaAddress.current) {
      analytics.identify(solanaAddress, { walletType: 'solana', walletCategory })
      analytics.trackWalletConnect({ address: solanaAddress, walletType: 'solana', walletCategory })
    }
    prevSolanaAddress.current = solanaAddress
  }, [solanaAddress, hasEmbeddedWallet])

  useEffect(() => {
    // Reset analytics when both wallets disconnect
    if (!evmAddress && !solanaAddress && (prevEvmAddress.current || prevSolanaAddress.current)) {
      analytics.reset()
    }
  }, [evmAddress, solanaAddress])
}
