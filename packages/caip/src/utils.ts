import type { ChainNamespace, ChainReference } from './constants.js'
import { VALID_CHAIN_IDS } from './constants.js'

export const isValidChainPartsPair = (chainNamespace: ChainNamespace, chainReference: ChainReference): boolean => {
  const validChainIds = VALID_CHAIN_IDS[chainNamespace]
  return validChainIds?.includes(chainReference) || false
}
