import Safe from '@safe-global/protocol-kit'
import type { Eip1193Provider } from '@safe-global/protocol-kit'
import { getViemClient } from '@shapeshiftoss/utils'
import { keccak256, encodePacked } from 'viem'

import { toChecksumAddress } from './addressValidation'

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
      },
    },
  })

  const predicted = await protocolKit.getAddress()
  cache.set(key, predicted)
  return predicted
}
