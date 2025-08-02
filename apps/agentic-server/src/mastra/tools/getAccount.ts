import { createTool, createStep } from '@mastra/core'
import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { toAssetId, ASSET_NAMESPACE } from '@shapeshiftoss/caip'
import type { Account } from '@shapeshiftoss/types'
import { fromBaseUnit, getFeeAssetByChainId, getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'
import axios from 'axios'
import { z } from 'zod'

export const getAccountInput = z.object({
  address: z.string().describe('The address to get account details for'),
  chainId: z.string().describe('The chainId for the account'),
})

export const getAccountOutput = z.object({
  portfolio: z.record(z.string(), z.string()).describe('Asset balances'),
})

export type GetAccountInput = z.infer<typeof getAccountInput>
export type GetAccountOutput = z.infer<typeof getAccountOutput>

export const getAccountTool = createTool({
  id: 'getAccount',
  description: 'Get account information including balances and token details',
  inputSchema: getAccountInput,
  outputSchema: getAccountOutput,
  execute: async ({ context }) => {
    return getAccount(context)
  },
})

export const getAccountStep = createStep({
  id: 'getAccount',
  description: 'Get account information including balances and token details',
  inputSchema: getAccountInput,
  outputSchema: getAccountOutput,
  execute: async ({ inputData }) => {
    return getAccount(inputData)
  },
})

const getAccount = async ({ address, chainId }: GetAccountInput): Promise<GetAccountOutput> => {
  const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]

  const { data } = await axios.get<Account>(`${baseUrl}/api/v1/account/${address}`)

  const feeAssetId = getFeeAssetByChainId(chainId as ChainId)

  if (!feeAssetId) throw new Error(`Fee asset not found for chainId: ${chainId}`)

  const portfolio = data.tokens.reduce<Record<AssetId, string>>(
    (acc, token) => {
      const assetId = toAssetId({
        chainId: chainId,
        assetNamespace: ASSET_NAMESPACE.erc20,
        assetReference: token.contract,
      })
      acc[assetId] = fromBaseUnit(token.balance, token.decimals)
      return acc
    },
    {
      [feeAssetId]: fromBaseUnit(data.balance, 18),
    }
  )

  return { portfolio }
}
