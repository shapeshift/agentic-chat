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

export const isSuiChain = (chainId: string): boolean => {
  return getChainNamespace(chainId) === CHAIN_NAMESPACE.Sui
}

export const isUtxoChain = (chainId: string): boolean => {
  return getChainNamespace(chainId) === CHAIN_NAMESPACE.Utxo
}

export const isCosmosChain = (chainId: string): boolean => {
  return getChainNamespace(chainId) === CHAIN_NAMESPACE.CosmosSdk
}

export const isTronChain = (chainId: string): boolean => {
  return getChainNamespace(chainId) === CHAIN_NAMESPACE.Tron
}

export const isCardanoChain = (chainId: string): boolean => {
  return getChainNamespace(chainId) === CHAIN_NAMESPACE.Cardano
}
