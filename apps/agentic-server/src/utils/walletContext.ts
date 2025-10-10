import type { RuntimeContext } from '@mastra/core/runtime-context'
import {
  arbitrumChainId,
  baseChainId,
  bscChainId,
  ethChainId,
  gnosisChainId,
  optimismChainId,
  polygonChainId,
} from '@shapeshiftoss/caip'

import { isSolanaChain } from './chains/helpers'

interface WalletContext {
  evmAddress?: string
  solanaAddress?: string
}

const EVM_CHAIN_IDS = [
  ethChainId,
  arbitrumChainId,
  optimismChainId,
  baseChainId,
  gnosisChainId,
  bscChainId,
  polygonChainId,
]

/**
 * Extracts the wallet address for a specific chainId from the RuntimeContext.
 *
 * The wallet context is injected into RuntimeContext by the chat handler middleware.
 * The simple context (evmAddress, solanaAddress) is expanded here to all supported chains.
 *
 * @param runtimeContext - The Mastra runtime context with wallet addresses
 * @param chainId - The CAIP-2 chainId to find an address for
 * @returns The wallet address for the specified chain
 * @throws Error if no wallet is connected for the specified chain
 */
export function getAddressForChain(runtimeContext: RuntimeContext<unknown>, chainId: string): string {
  const walletContext = runtimeContext.get<'walletContext', WalletContext>('walletContext')

  if (!walletContext) {
    console.error('[walletContext] No wallet context found in RuntimeContext')
    throw new Error('No wallet connected. Please connect your wallet.')
  }

  if (isSolanaChain(chainId)) {
    if (!walletContext.solanaAddress) {
      throw new Error('No Solana wallet connected. Please connect a Solana wallet.')
    }
    return walletContext.solanaAddress
  }

  if (EVM_CHAIN_IDS.includes(chainId)) {
    if (!walletContext.evmAddress) {
      throw new Error('No EVM wallet connected. Please connect an EVM wallet.')
    }
    return walletContext.evmAddress
  }

  throw new Error(`Unsupported chain: ${chainId}`)
}
