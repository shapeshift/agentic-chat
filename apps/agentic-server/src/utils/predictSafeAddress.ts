import Safe from '@safe-global/protocol-kit'
import type { Eip1193Provider } from '@safe-global/protocol-kit'
import { getViemClient } from '@shapeshiftoss/utils'
import { keccak256, encodePacked } from 'viem'

import { toChecksumAddress } from './addressValidation'

// Pinned so SDK default changes can't silently break existing Safe addresses
const SAFE_VERSION = '1.3.0'

const MAX_CACHE_SIZE = 1000
const cache = new Map<string, string>()

export async function predictSafeAddress(ownerAddress: string, chainId: number): Promise<string> {
  const key = `${ownerAddress.toLowerCase()}:${chainId}`
  const cached = cache.get(key)
  if (cached) return cached

  const caipChainId = `eip155:${chainId}`
  const client = getViemClient(caipChainId)
  const provider = { request: client.request } as Eip1193Provider

  const saltNonce = keccak256(encodePacked(['address'], [toChecksumAddress(ownerAddress)]))

  const protocolKit = await Safe.init({
    provider,
    predictedSafe: {
      safeAccountConfig: {
        owners: [ownerAddress],
        threshold: 1,
      },
      safeDeploymentConfig: {
        saltNonce,
        safeVersion: SAFE_VERSION,
      },
    },
  })

  const predicted = await protocolKit.getAddress()
  cache.set(key, predicted)
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  return predicted
}
