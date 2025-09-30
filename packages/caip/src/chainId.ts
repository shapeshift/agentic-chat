import type { ChainId, ChainNamespace, ChainReference } from './constants.js'
import { assertIsChainId } from './typeGuards.js'

export type ToChainIdArgs = {
  chainNamespace: ChainNamespace
  chainReference: ChainReference
}

export type FromChainIdReturn = {
  chainNamespace: ChainNamespace
  chainReference: ChainReference
}

export const toChainId = (args: ToChainIdArgs): ChainId => {
  const { chainNamespace, chainReference } = args
  const maybeChainId = `${chainNamespace}:${chainReference}`
  assertIsChainId(maybeChainId)
  return maybeChainId
}

export const fromChainId = (chainId: ChainId): FromChainIdReturn => {
  const idx = chainId.indexOf(':')
  const chainNamespace = chainId.substring(0, idx) as ChainNamespace
  const chainReference = chainId.substring(idx + 1) as ChainReference
  return {
    chainNamespace,
    chainReference,
  }
}
