import { getViemClient } from '@shapeshiftoss/utils'
import { getAddress } from 'viem'

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

  const code = await client.getCode({ address: safeAddress as `0x${string}` })
  if (!code || code === '0x') return // not deployed yet — trust the prediction

  const owners = await client.readContract({
    address: safeAddress as `0x${string}`,
    abi: SAFE_GET_OWNERS_ABI,
    functionName: 'getOwners',
  })

  const normalizedExpected = getAddress(expectedOwner)
  const isOwner = (owners as string[]).some(owner => getAddress(owner) === normalizedExpected)

  if (!isOwner) {
    throw new Error(
      `Safe address ${safeAddress} is not owned by the connected wallet ${expectedOwner}. ` +
        'This may indicate a tampered request.'
    )
  }
}
