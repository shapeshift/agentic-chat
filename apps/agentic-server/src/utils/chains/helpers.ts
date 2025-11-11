import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'

export const isEvmChain = (chainId: string): boolean => {
  const { chainNamespace } = fromChainId(chainId)
  return chainNamespace === CHAIN_NAMESPACE.Evm
}

export const isSolanaChain = (chainId: string): boolean => {
  const { chainNamespace } = fromChainId(chainId)
  return chainNamespace === CHAIN_NAMESPACE.Solana
}

/**
 * Check if chain supports transaction operations (send, swap, etc.)
 * Currently only EVM and Solana chains are supported
 */
export const supportsTxOperations = (chainId: string): boolean => {
  return isEvmChain(chainId) || isSolanaChain(chainId)
}
