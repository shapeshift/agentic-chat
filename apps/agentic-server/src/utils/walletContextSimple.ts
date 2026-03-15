import type { Network } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'

import { predictSafeAddress } from './predictSafeAddress'
import { verifySafeOwnership } from './safeAddressVerification'

export interface SafeChainDeployment {
  isDeployed: boolean
  modulesEnabled: boolean
  domainVerifierSet: boolean
  safeAddress: string
}

export interface ActiveOrderSummary {
  orderHash: string
  chainId: number
  sellTokenAddress: string
  sellTokenSymbol: string
  sellAmountBaseUnit: string
  sellAmountHuman: string
  buyTokenAddress: string
  buyTokenSymbol: string
  buyAmountHuman: string
  strikePrice: string
  validTo: number
  submitTxHash: string
  createdAt: number
  network: string
  status: 'open' | 'triggered' | 'fulfilled' | 'cancelled' | 'expired' | 'failed' | 'partiallyFilled'
  orderType: 'stopLoss' | 'twap'
  numParts?: number
}

export interface KnownTransaction {
  txHash: string
  type: 'swap' | 'send' | 'limitOrder' | 'stopLoss' | 'twap' | 'deposit' | 'withdraw' | 'approval'
  sellSymbol?: string
  sellAmount?: string
  buySymbol?: string
  buyAmount?: string
  network?: string
}

export interface WalletContext {
  connectedWallets?: Record<string, { address: string }>
  safeAddress?: string
  safeDeploymentState?: Record<number, SafeChainDeployment>
  registryOrders?: ActiveOrderSummary[]
  knownTransactions?: KnownTransaction[]
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

export async function getSafeAddressForChain(
  walletContext: WalletContext | undefined,
  chainId: number
): Promise<string | undefined> {
  const knownAddress = walletContext?.safeDeploymentState?.[chainId]?.safeAddress
  if (knownAddress) {
    const caipChainId = `eip155:${chainId}`
    const ownerAddress = walletContext?.connectedWallets?.[caipChainId]?.address
    if (ownerAddress) await verifySafeOwnership(knownAddress, ownerAddress, chainId)
    return knownAddress
  }

  const caipChainId = `eip155:${chainId}`
  const ownerAddress = walletContext?.connectedWallets?.[caipChainId]?.address
  if (!ownerAddress) return walletContext?.safeAddress

  const safeAddress = await predictSafeAddress(ownerAddress, chainId)
  await verifySafeOwnership(safeAddress, ownerAddress, chainId)
  return safeAddress
}
