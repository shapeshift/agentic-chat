import { getViemClient } from '@shapeshiftoss/utils'

import { toChecksumAddress } from './addressValidation'
import { predictSafeAddress } from './predictSafeAddress'

const SAFE_GET_OWNERS_ABI = [
  {
    name: 'getOwners',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
] as const

export async function verifySafeOwnership(safeAddress: string, expectedOwner: string, chainId: number): Promise<void> {
  const caipChainId = `eip155:${chainId}`
  const client = getViemClient(caipChainId)

  const code = await client.getCode({ address: toChecksumAddress(safeAddress) })
  if (!code || code === '0x') {
    const predicted = await predictSafeAddress(expectedOwner, chainId)
    if (toChecksumAddress(predicted) !== toChecksumAddress(safeAddress)) {
      throw new Error(
        `Safe address ${safeAddress} does not match the predicted address for wallet ${expectedOwner}. ` +
          'This may indicate a tampered request.'
      )
    }
    return
  }

  const owners = await client.readContract({
    address: toChecksumAddress(safeAddress),
    abi: SAFE_GET_OWNERS_ABI,
    functionName: 'getOwners',
  })

  const normalizedExpected = toChecksumAddress(expectedOwner)
  const isOwner = (owners as string[]).some(owner => toChecksumAddress(owner) === normalizedExpected)

  if (!isOwner) {
    throw new Error(
      `Safe address ${safeAddress} is not owned by the connected wallet ${expectedOwner}. ` +
        'This may indicate a tampered request.'
    )
  }
}
