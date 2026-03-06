import { isEthereumWallet } from '@dynamic-labs/ethereum'
import type { EthereumWallet } from '@dynamic-labs/ethereum-core'
import { useDynamicContext, useUserWallets } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { SolanaWallet } from '@dynamic-labs/solana-core'

import { findEvmWallet, findSolanaWallet } from '@/lib/walletUtils'

import { useApprovedChains } from './useApprovedChains'
import type { SafeChainDeployment } from './useSafeAccount'
import { useSafeAccount } from './useSafeAccount'

export { filterEvmWallets, filterSolanaWallets, findEvmWallet, findSolanaWallet } from '@/lib/walletUtils'

interface WalletConnectionResult {
  isConnected: boolean
  evmAddress: string | undefined
  solanaAddress: string | undefined
  primaryAddress: string | undefined
  approvedChainIds: string[]
  evmWallet: EthereumWallet | undefined
  solanaWallet: SolanaWallet | undefined
  safeAddress: string | undefined
  safeDeploymentState: Record<number, SafeChainDeployment>
}

export function useWalletConnection(): WalletConnectionResult {
  const { primaryWallet } = useDynamicContext()
  const userWallets = useUserWallets()
  const approvedChainIds = useApprovedChains()
  const safeAccount = useSafeAccount()

  const primaryEvmWallet = primaryWallet && isEthereumWallet(primaryWallet) ? primaryWallet : undefined
  const primarySolanaWallet = primaryWallet && isSolanaWallet(primaryWallet) ? primaryWallet : undefined

  const evmWallet = primaryEvmWallet ?? findEvmWallet(userWallets)
  const solanaWallet = primarySolanaWallet ?? findSolanaWallet(userWallets)

  const evmAddress = evmWallet?.address
  const solanaAddress = solanaWallet?.address

  const isConnected = !!evmAddress || !!solanaAddress

  return {
    isConnected,
    evmAddress,
    solanaAddress,
    primaryAddress: primaryWallet?.address,
    approvedChainIds,
    evmWallet,
    solanaWallet,
    safeAddress: safeAccount.safeAddress,
    safeDeploymentState: safeAccount.safeDeploymentState,
  }
}
