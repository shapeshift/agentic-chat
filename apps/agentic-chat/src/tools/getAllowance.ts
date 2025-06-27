import { fromAssetId, fromChainId } from '@shapeshiftoss/caip'
import { fromBaseUnit } from '@shapeshiftoss/utils'
import { getPublicClient } from '@wagmi/core'
import type { Address } from 'viem'
import { erc20Abi, getAddress } from 'viem'
import z from 'zod'

import { wagmiConfig } from '../lib/wagmi-config'
import type { AssetsStore } from '../stores/assets'
import { getFeeAssetByChainId } from '../utils/getFeeAssetByChainId'

export const getAllowanceParams = z.object({
  assetId: z.string().describe('The token AssetId to check allowance against'),
  spender: z.string().describe('The address of the spender to check allowance from'),
})

export type GetAllowanceParams = z.infer<typeof getAllowanceParams>
export type GetAllowanceResult = string

export const getAllowance = async ({
  assetId,
  from,
  spender,
  assetsStore,
}: GetAllowanceParams & {
  from: Address | undefined
  assetsStore: AssetsStore
}): Promise<GetAllowanceResult> => {
  if (!from) {
    throw new Error('No account connected')
  }

  if (assetId === getFeeAssetByChainId(fromAssetId(assetId).chainId)) {
    return 'No allowance is needed for native assets'
  }

  const { chainId, assetReference } = fromAssetId(assetId)
  const { chainReference } = fromChainId(chainId)

  const asset = assetsStore.assetsById[assetId]

  if (!asset) throw new Error('asset is required for precision lookup')

  const publicClient = getPublicClient(wagmiConfig, {
    chainId: Number(chainReference),
  })

  if (!publicClient) throw new Error('Public client not found for the specified chain')

  const allowance = await publicClient.readContract({
    address: getAddress(assetReference),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [from, getAddress(spender)],
  })

  return fromBaseUnit(allowance.toString(), asset.precision)
}
