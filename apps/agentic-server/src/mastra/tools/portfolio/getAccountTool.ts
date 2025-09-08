import { createTool } from '@mastra/core'
import type { AssetId } from '@shapeshiftoss/caip'
import { ASSET_NAMESPACE, toAssetId } from '@shapeshiftoss/caip'
import type { Account } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId, getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

const portfolio = z.array(
  z.object({
    assetId: z.string(),
    balance: z.string(),
  })
)

type Portfolio = z.infer<typeof portfolio>

export const getAccountInput = z.object({
  address: z.string().describe('The address to get account details for'),
  chainId: z.string().describe('The chainId for the account in caip-10 format (ex. eip155:1)'),
})

export const getAccountOutput = z.object({
  address: z.string(),
  chainId: z.string(),
  portfolio: portfolio,
})

export type GetAccountInput = z.infer<typeof getAccountInput>
export type GetAccountOutput = z.infer<typeof getAccountOutput>

export const getAccountTool = createTool({
  id: 'getAccount',
  description: 'Get account information including balances and token details',
  inputSchema: getAccountInput,
  outputSchema: getAccountOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('getAccountTool:', { context })

    return getAccount(context)
  },
})

const getAccount = async ({ address, chainId }: GetAccountInput): Promise<GetAccountOutput> => {
  const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]

  const { data } = await axios.get<Account>(`${baseUrl}/api/v1/account/${address}`)

  const portfolio = data.tokens.reduce<Portfolio>((acc, token) => {
    if (['ERC20', 'BEP20'].includes(token.type)) {
      acc.push({
        assetId: toAssetId({ chainId, assetNamespace: ASSET_NAMESPACE.erc20, assetReference: token.contract }),
        balance: token.balance,
      })
    }
    return acc
  }, [])

  portfolio.push({
    assetId: getFeeAssetIdByChainId(chainId) as AssetId,
    balance: data.balance,
  })

  return { address, chainId, portfolio }
}
