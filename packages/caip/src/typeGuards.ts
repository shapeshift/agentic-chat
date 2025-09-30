import { fromChainId } from './chainId.js'
import type { AssetNamespace, AssetReference, ChainId, ChainNamespace, ChainReference } from './constants.js'
import { ASSET_NAMESPACE, ASSET_REFERENCE, CHAIN_NAMESPACE, CHAIN_REFERENCE, VALID_CHAIN_IDS } from './constants.js'
import { isValidChainPartsPair } from './utils.js'

export const isChainNamespace = (maybeChainNamespace: string): maybeChainNamespace is ChainNamespace =>
  Object.values(CHAIN_NAMESPACE).includes(maybeChainNamespace as ChainNamespace)

export const isChainReference = (maybeChainReference: string): maybeChainReference is ChainReference =>
  Object.values(CHAIN_REFERENCE).includes(maybeChainReference as ChainReference)

export const isAssetNamespace = (maybeAssetNamespace: string): maybeAssetNamespace is AssetNamespace =>
  Object.values(ASSET_NAMESPACE).includes(maybeAssetNamespace as AssetNamespace)

export const isAssetReference = (maybeAssetReference: string): maybeAssetReference is AssetReference =>
  Object.values(ASSET_REFERENCE).includes(maybeAssetReference as AssetReference)

export const isAssetIdParts = (
  maybeChainNamespace: string,
  maybeChainReference: string,
  maybeAssetNamespace: string
): boolean => {
  const validChainIds = VALID_CHAIN_IDS[maybeChainNamespace as ChainNamespace]
  return !!validChainIds?.includes(maybeChainReference) && isAssetNamespace(maybeAssetNamespace)
}

export const isChainId = (maybeChainId: string): maybeChainId is ChainId => {
  const { chainNamespace, chainReference } = fromChainId(maybeChainId)
  const validChainIds = VALID_CHAIN_IDS[chainNamespace]
  return !!validChainIds?.includes(chainReference)
}

const getTypeGuardAssertion = <T>(typeGuard: (value: string) => boolean, message: string) => {
  return (value: T): void => {
    if ((value && !typeGuard(value as string)) || !value) {
      throw new Error(`${message}: ${value}`)
    }
  }
}

export const assertIsChainId = getTypeGuardAssertion<ChainId>(isChainId, 'assertIsChainId: unsupported ChainId')
export const assertIsChainNamespace = getTypeGuardAssertion<ChainNamespace>(
  isChainNamespace,
  'assertIsChainNamespace: unsupported ChainNamespace'
)
export const assertIsChainReference = getTypeGuardAssertion<ChainReference>(
  isChainReference,
  'assertIsChainReference: unsupported ChainReference'
)
export const assertIsAssetNamespace = getTypeGuardAssertion<AssetNamespace>(
  isAssetNamespace,
  'assertIsAssetNamespace: unsupported AssetNamespace'
)
export const assertIsAssetReference = getTypeGuardAssertion<AssetReference>(
  isAssetReference,
  'assertIsAssetReference: unsupported AssetReference'
)
export const assertValidChainPartsPair = (chainNamespace: ChainNamespace, chainReference: ChainReference): void => {
  if (!isValidChainPartsPair(chainNamespace, chainReference)) {
    throw new Error(`toAssetId: Chain Reference ${chainReference} not supported for Chain Namespace ${chainNamespace}`)
  }
}
