import type { Network } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'

export interface SafeChainDeployment {
  isDeployed: boolean
  modulesEnabled: boolean
  domainVerifierSet: boolean
}

export interface WalletContext {
  connectedWallets?: Record<string, { address: string }>
  hasEmbeddedWallet?: boolean
  hasExternalWallet?: boolean
  safeAddress?: string
  safeDeploymentState?: Record<number, SafeChainDeployment>
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

export function isSafeReadyOnChain(walletContext: WalletContext | undefined, chainId: number): boolean {
  const chainState = walletContext?.safeDeploymentState?.[chainId]
  if (!chainState) return false
  return chainState.isDeployed && chainState.modulesEnabled && chainState.domainVerifierSet
}
