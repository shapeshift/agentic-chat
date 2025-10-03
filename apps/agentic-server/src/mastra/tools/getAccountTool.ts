import { createTool } from '@mastra/core'
import {
  ASSET_NAMESPACE,
  CHAIN_NAMESPACE,
  ethChainId,
  fromChainId,
  solanaChainId,
  toAssetId,
} from '@shapeshiftoss/caip'
import type { Account } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId, getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

import { getSolanaAccount } from '../../utils/solana/index.js'

export const getAccountInput = z.object({
  account: z.string().describe('The user address or xpub to get account details for'),
  chainId: z
    .string()
    .describe(
      'The FULL chainId in CAIP-2 format - MUST include complete chain reference. Examples: eip155:1 (Ethereum), solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp (Solana mainnet). NEVER abbreviate or truncate the chain reference part.'
    ),
})

export const getAccountOutput = z.object({
  account: z.string().describe('The user address or xpub to get account details for'),
  chainId: z.string().describe('The chainId for the account in caip-10 format (ex. eip155:1)'),
  balances: z.record(
    z.string().describe('The assetId for the asset in caip-19 format (ex. eip155:1/slip44:60)'),
    z.string().describe('The current balance value for the asset')
  ),
})

export type GetAccountInput = z.infer<typeof getAccountInput>
export type GetAccountOutput = z.infer<typeof getAccountOutput>

export const getAccountTool = createTool({
  id: 'getAccount',
  description: 'Get raw account balances in base units',
  inputSchema: getAccountInput,
  outputSchema: getAccountOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger()

    logger?.info('getAccountTool:', { context })

    const { account, chainId } = context

    logger?.info('getAccountTool - checking chainId:', {
      chainId,
      chainIdType: typeof chainId,
      account,
      accountType: typeof account,
    })

    const feeAssetId = getFeeAssetIdByChainId(chainId)

    if (!feeAssetId) {
      logger?.error('getAccountTool - Invalid chainId:', {
        chainId,
        feeAssetId,
        availableChainIds: {
          solana: solanaChainId,
          eth: ethChainId,
        },
      })
      throw new Error(`Invalid chainId: ${chainId}`)
    }

    const { chainNamespace } = fromChainId(chainId)

    if (chainNamespace === CHAIN_NAMESPACE.Solana) {
      const { balances } = await getSolanaAccount(account, chainId)
      return { account, chainId, balances }
    }

    if (chainNamespace === CHAIN_NAMESPACE.Evm) {
      const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]
      const { data } = await axios.get<Account>(`${baseUrl}/api/v1/account/${account}`)

      const balances = data.tokens.reduce<z.infer<typeof getAccountOutput>['balances']>((acc, token) => {
        if (['ERC20', 'BEP20'].includes(token.type)) {
          const assetId = toAssetId({
            chainId,
            assetNamespace: ASSET_NAMESPACE.erc20,
            assetReference: token.contract.toLowerCase(),
          })
          acc[assetId] = token.balance
        }
        return acc
      }, {})

      balances[feeAssetId] = data.balance

      return { account, chainId, balances }
    }

    throw new Error(`Unsupported chain namespace: ${chainNamespace}`)
  },
})
