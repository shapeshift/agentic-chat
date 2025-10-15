import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'

import type { ChainNamespace } from './types'

export const getChainNamespace = (chainId: string): ChainNamespace => {
  const { chainNamespace } = fromChainId(chainId)
  return chainNamespace as ChainNamespace
}

export const isEvmChain = (chainId: string): boolean => {
  return getChainNamespace(chainId) === CHAIN_NAMESPACE.Evm
}

export const isSolanaChain = (chainId: string): boolean => {
  return getChainNamespace(chainId) === CHAIN_NAMESPACE.Solana
}
