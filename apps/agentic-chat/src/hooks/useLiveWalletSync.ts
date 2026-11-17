import { useEffect } from 'react'

import { setLiveWallet } from '@/lib/liveWallet'

import { useWalletConnection } from './useWalletConnection'

export function useLiveWalletSync(): void {
  const { evmAddress, solanaAddress, solanaWallet } = useWalletConnection()

  useEffect(() => {
    setLiveWallet({ evmAddress, solanaAddress, solanaWallet })
  }, [evmAddress, solanaAddress, solanaWallet])

  useEffect(() => () => setLiveWallet({}), [])
}
