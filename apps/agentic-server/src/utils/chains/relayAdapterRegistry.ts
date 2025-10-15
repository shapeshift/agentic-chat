import { fromChainId } from '@shapeshiftoss/caip'

import { evmAdapter } from './evm'
import { solanaAdapter } from './solana'
import type { ChainAdapter, ChainNamespace } from './types'

/**
 * Chain adapters for formatting data for Relay API.
 * These adapters convert CAIP chain/asset IDs to Relay's expected format.
 */

const chainAdapters: Partial<Record<ChainNamespace, ChainAdapter>> = {
  eip155: evmAdapter,
  solana: solanaAdapter,
  // Sui and UTXO chains (bip122) are not supported by Relay API for swaps
}

export function getChainAdapter(chainId: string): ChainAdapter {
  const { chainNamespace } = fromChainId(chainId)

  const adapter = chainAdapters[chainNamespace as ChainNamespace]

  if (!adapter) {
    throw new Error(`Unsupported chain namespace for Relay swaps: ${chainNamespace}`)
  }

  return adapter
}
