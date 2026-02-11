import type { Network } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'

export interface WalletContext {
  connectedWallets?: Record<string, { address: string }>
  hasEmbeddedWallet?: boolean
  hasExternalWallet?: boolean
  safeAddress?: string
  isSafeDeployed?: boolean
  isSafeReady?: boolean
}

export function getAddressForNetwork(walletContext: WalletContext | undefined, network: Network): string {
  const chainId = networkToChainIdMap[network]
  return getAddressForChain(walletContext, chainId)
}

export function getAddressForChain(walletContext: WalletContext | undefined, chainId: string): string {
  if (!walletContext || !walletContext.connectedWallets) {
    throw new Error('No wallet connected. Please connect your wallet.')
  }

  const wallet = walletContext.connectedWallets[chainId]

  if (!wallet?.address) {
    const availableChains = Object.keys(walletContext.connectedWallets)
    throw new Error(`No wallet connected for chain ${chainId}. Available chains: ${availableChains.join(', ')}`)
  }

  return wallet.address
}
