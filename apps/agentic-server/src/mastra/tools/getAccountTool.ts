import { createTool } from '@mastra/core'
import { ASSET_NAMESPACE, toAssetId, fromChainId, CHAIN_NAMESPACE } from '@shapeshiftoss/caip'
import type { Account } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId, getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

export const getAccountInput = z.object({
  account: z.string().describe('The user address or xpub to get account details for'),
  chainId: z.string().describe('The chainId for the account in caip-10 format (ex. eip155:1)'),
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

    const feeAssetId = getFeeAssetIdByChainId(chainId)

    if (!feeAssetId) throw new Error(`Invalid chainId: ${chainId}`)

    const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]
    const { data } = await axios.get<Account>(`${baseUrl}/api/v1/account/${account}`)

    const { chainNamespace } = fromChainId(chainId)

    if (chainNamespace === CHAIN_NAMESPACE.Utxo) {
      throw new Error('UTXO chains are not supported for account queries')
    }

    if (chainNamespace === CHAIN_NAMESPACE.Solana) {
      const balances = data.tokens.reduce<z.infer<typeof getAccountOutput>['balances']>((acc, token) => {
        if (!token.id) return acc
        const assetId = toAssetId({
          chainId,
          assetNamespace: ASSET_NAMESPACE.splToken,
          assetReference: token.id,
        })
        acc[assetId] = token.balance
        return acc
      }, {})

      balances[feeAssetId] = data.balance

      return { account, chainId, balances }
    }

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
  },
})
