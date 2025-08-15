import { createTool, createStep } from '@mastra/core'
import type { IMastraLogger } from '@mastra/core/logger'
import type { Account } from '@shapeshiftoss/types'
import { getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'
import axios from 'axios'
import { z } from 'zod'

export const getAccountInput = z.object({
  address: z.string().describe('The address to get account details for'),
  chainId: z.string().describe('The chainId for the account'),
})

export const getAccountOutput = z.object({
  portfolio: z.array(
    z.object({
      address: z.string().optional(),
      balance: z.string(),
      assetNamespace: z.string(),
    })
  ),
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

    return getAccount(context, logger)
  },
})

export const getAccountStep = createStep({
  id: 'getAccount',
  description: 'Get account information including balances and token details',
  inputSchema: getAccountInput,
  outputSchema: getAccountOutput,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger()

    logger.info('getAccountStep:', { inputData })

    return getAccount(inputData, logger)
  },
})

const getAccount = async ({ address, chainId }: GetAccountInput, logger: IMastraLogger): Promise<GetAccountOutput> => {
  const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]

  const { data } = await axios.get<Account>(`${baseUrl}/api/v1/account/${address}`)

  const portfolio = data.tokens.map(token => ({
    address: token.contract,
    symbol: token.symbol,
    balance: token.balance,
    assetNamespace: getAssetNamespace(token.type),
  }))

  //portfolio.push({
  //  address: '',
  //  balance: data.balance,
  //  assetNamespace: ASSET_NAMESPACE.slip44,
  //})

  logger.info('getAccount', { portfolio })

  return { portfolio }
}

const getAssetNamespace = (type: string) => {
  if (type === 'ERC20') return 'erc20'
  if (type === 'ERC721') return 'erc721'
  if (type === 'ERC1155') return 'erc1155'
  if (type === 'BEP20') return 'erc20'
  if (type === 'BEP721') return 'erc721'
  if (type === 'BEP1155') return 'erc1155'
  throw new Error(`Unknown asset namespace. type: ${type}`)
}
