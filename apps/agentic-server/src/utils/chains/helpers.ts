import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'

export const isEvmChain = (chainId: string): boolean => {
  const { chainNamespace } = fromChainId(chainId)
  return chainNamespace === CHAIN_NAMESPACE.Evm
}

export const isSolanaChain = (chainId: string): boolean => {
  const { chainNamespace } = fromChainId(chainId)
  return chainNamespace === CHAIN_NAMESPACE.Solana
}
