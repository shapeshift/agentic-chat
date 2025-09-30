import { fromChainId, toChainId } from './chainId.js'
import type { AssetId, AssetNamespace, ChainId, ChainNamespace, ChainReference } from './constants.js'
import { VALID_ASSET_NAMESPACE } from './constants.js'
import {
  assertIsAssetNamespace,
  assertIsChainNamespace,
  assertIsChainReference,
  assertValidChainPartsPair,
  isAssetNamespace,
} from './typeGuards.js'

const isValidSlip44 = (value: string): boolean => {
  if (value === 'tcy') return true
  const n = Number(value)
  return !isNaN(n) && n >= 0 && n < 4294967296
}

type ToAssetIdWithChainIdArgs = {
  chainId: ChainId
  assetNamespace: AssetNamespace
  assetReference: string
}

type ToAssetIdWithChainPartsArgs = {
  chainNamespace: ChainNamespace
  chainReference: ChainReference
  assetNamespace: AssetNamespace
  assetReference: string
}

export type ToAssetIdArgs = ToAssetIdWithChainIdArgs | ToAssetIdWithChainPartsArgs

const isToAssetIdWithChainIdArgs = (args: ToAssetIdArgs): args is ToAssetIdWithChainIdArgs =>
  'chainId' in args && !!args.chainId

export type FromAssetIdReturn = {
  assetId: AssetId
  chainId: ChainId
  chainNamespace: ChainNamespace
  chainReference: ChainReference
  assetNamespace: AssetNamespace
  assetReference: string
}

export const toAssetId = (args: ToAssetIdArgs): AssetId => {
  const { assetNamespace, assetReference } = args
  assertIsAssetNamespace(assetNamespace)

  if (!assetReference) throw new Error('toAssetId: No assetReference provided')

  const { chainId, chainNamespace, chainReference } = (() => {
    if (isToAssetIdWithChainIdArgs(args)) {
      const fromChainIdResult = fromChainId(args.chainId)
      return {
        chainId: args.chainId,
        chainNamespace: fromChainIdResult.chainNamespace,
        chainReference: fromChainIdResult.chainReference,
      }
    } else {
      return {
        chainId: toChainId({
          chainNamespace: args.chainNamespace,
          chainReference: args.chainReference,
        }),
        chainNamespace: args.chainNamespace,
        chainReference: args.chainReference,
      }
    }
  })()

  assertIsChainNamespace(chainNamespace)
  assertIsChainReference(chainReference)
  assertValidChainPartsPair(chainNamespace, chainReference)

  const validAssetNamespaces = VALID_ASSET_NAMESPACE[chainNamespace]
  if (!validAssetNamespaces.includes(assetNamespace) || !isAssetNamespace(assetNamespace)) {
    throw new Error(`toAssetId: AssetNamespace ${assetNamespace} not supported for Chain Namespace ${chainNamespace}`)
  }

  if (assetNamespace === 'slip44' && !isValidSlip44(String(assetReference))) {
    throw new Error(`Invalid reference for namespace slip44`)
  }

  return `${chainId}/${assetNamespace}:${assetReference}`
}

export const fromAssetId = (assetId: AssetId): FromAssetIdReturn => {
  const slashIdx = assetId.indexOf('/')
  const chainId = assetId.substring(0, slashIdx)
  const assetParts = assetId.substring(slashIdx + 1)

  const { chainNamespace, chainReference } = fromChainId(chainId)

  const colonIdx = assetParts.indexOf(':')
  const assetNamespace = assetParts.substring(0, colonIdx) as AssetNamespace
  const assetReference = assetParts.substring(colonIdx + 1)

  return {
    assetId,
    chainId,
    chainNamespace,
    chainReference,
    assetNamespace,
    assetReference,
  }
}
