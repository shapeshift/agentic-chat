import { fromAssetId, fromChainId } from '@shapeshiftoss/caip'
import { toBaseUnit } from '@shapeshiftoss/utils'
import type { Chain, WalletClient } from 'viem'
import { encodeFunctionData, erc20Abi, extractChain, getAddress } from 'viem'
import z from 'zod'

import { networks } from '../lib/appkit'
import type { AssetsStore } from '../stores/assets'

export const approveParamsSchema = z.object({
  assetId: z.string().describe('The token AssetId to approve'),
  spender: z.string().describe('The address that will be approved to spend the tokens'),
  amountCryptoPrecision: z.string().describe('Amount to approve in human format, e.g. 1 for 1 token'),
})

export type ApproveParams = z.infer<typeof approveParamsSchema>
export type ApproveResult = string // Tx hash

export const approve = async ({
  walletClient,
  assetId,
  spender,
  amountCryptoPrecision,
  assetsStore,
}: ApproveParams & {
  walletClient: WalletClient | undefined
  assetsStore: AssetsStore
}): Promise<ApproveResult> => {
  const account = walletClient?.account
  const asset = assetsStore.assetsById[assetId]

  if (!account?.address || !walletClient) {
    throw new Error('No account connected')
  }

  if (!asset) throw new Error('Asset is required for precision lookup')

  const { chainId, assetReference } = fromAssetId(assetId)
  const { chainReference } = fromChainId(chainId)

  const amountCryptoBaseUnit = toBaseUnit(amountCryptoPrecision, asset.precision)

  try {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [getAddress(spender), BigInt(amountCryptoBaseUnit)],
    })

    const hash = await walletClient.sendTransaction({
      account: account,
      to: getAddress(assetReference),
      data,
      chain: extractChain({
        chains: networks as Chain[],
        id: Number(chainReference),
      }),
    })

    return hash
  } catch (err) {
    console.error('Error approving token', err)
    throw err
  }
}
