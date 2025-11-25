import { useAppKitAccount } from '@reown/appkit/react'
import { useAccount as useEvmAccount } from 'wagmi'

export function useWalletConnection() {
  const evmAccount = useEvmAccount()
  const { address: solanaAddress } = useAppKitAccount({ namespace: 'solana' })

  const evmAddress = evmAccount.address
  const isConnected = !!evmAddress || !!solanaAddress

  return {
    isConnected,
    evmAddress,
    solanaAddress,
  }
}
