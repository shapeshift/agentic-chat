import type { RuntimeContext } from '@mastra/core/runtime-context'
import type { Network } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'

interface WalletContext {
  connectedWallets: Record<string, { address: string }>
}

export function getAddressForNetwork(runtimeContext: RuntimeContext<unknown>, network: Network): string {
  const chainId = networkToChainIdMap[network]
  return getAddressForChain(runtimeContext, chainId)
}

export function getAddressForChain(runtimeContext: RuntimeContext<unknown>, chainId: string): string {
  const walletContext = runtimeContext.get<'walletContext', WalletContext>('walletContext')

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
