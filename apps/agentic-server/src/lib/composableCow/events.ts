import { getViemClient } from '@shapeshiftoss/utils'

import { COMPOSABLE_COW_ADDRESS } from './index'

const SINGLE_ORDERS_ABI = [
  {
    name: 'singleOrders',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'orderHash', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

export async function isConditionalOrderActive(
  ownerAddress: string,
  orderHash: `0x${string}`,
  chainId: number
): Promise<boolean> {
  const caipChainId = `eip155:${chainId}`
  const client = getViemClient(caipChainId)

  const result = await client.readContract({
    address: COMPOSABLE_COW_ADDRESS,
    abi: SINGLE_ORDERS_ABI,
    functionName: 'singleOrders',
    args: [ownerAddress as `0x${string}`, orderHash],
  })

  return result
}
