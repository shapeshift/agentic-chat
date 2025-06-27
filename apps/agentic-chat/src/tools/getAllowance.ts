import { fromBaseUnit } from '@shapeshiftoss/utils'
import { getPublicClient } from '@wagmi/core'
import { erc20Abi, getAddress } from 'viem'
import type { UseAccountReturnType } from 'wagmi'

import { wagmiConfig } from '../lib/wagmi-config'

export const getAllowance = async ({
  account,
  token,
  decimals,
  spender,
  chainId,
}: {
  account: UseAccountReturnType
  token: string
  decimals: number
  spender: string
  chainId: number
}) => {
  if (!account.address) {
    throw new Error('No account connected')
  }

  const publicClient = getPublicClient(wagmiConfig, { chainId })

  if (!publicClient) throw new Error('Public client not found for the specified chain')

  const allowance = await publicClient.readContract({
    address: getAddress(token),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, getAddress(spender)],
  })

  return fromBaseUnit(allowance.toString(), decimals)
}
