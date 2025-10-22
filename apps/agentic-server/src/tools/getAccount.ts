import { ASSET_NAMESPACE, CHAIN_NAMESPACE, fromChainId, toAssetId } from '@shapeshiftoss/caip'
import type { Account } from '@shapeshiftoss/types'
import { NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId, getUnchainedHttpUrlEnvVar } from '@shapeshiftoss/utils'
import axios from 'axios'
import { z } from 'zod'

export const getAccountSchema = z.object({
  account: z.string().describe('The user address or xpub to get account details for'),
  network: z.enum(NETWORKS).describe('Network name (e.g., ethereum, arbitrum, solana)'),
})

export type GetAccountInput = z.infer<typeof getAccountSchema>

export type GetAccountOutput = {
  account: string
  chainId: string
  balances: Record<string, string>
}

export async function executeGetAccount(input: GetAccountInput): Promise<GetAccountOutput> {
  console.log('[getAccount]:', input)

  const { account, network } = input
  const chainId = networkToChainIdMap[network]

  const feeAssetId = getFeeAssetIdByChainId(chainId)

  if (!feeAssetId) {
    throw new Error(`Invalid chainId: ${chainId}`)
  }

  const { chainNamespace } = fromChainId(chainId)
  const baseUrl = process.env[getUnchainedHttpUrlEnvVar(chainId)]

  let data: Account
  try {
    const response = await axios.get<Account>(`${baseUrl}/api/v1/account/${account}`, {
      timeout: 30000,
    })
    data = response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch account data: ${error.response?.statusText || error.message}`)
    }
    throw error
  }

  if (chainNamespace === CHAIN_NAMESPACE.Solana) {
    const balances = data.tokens.reduce<Record<string, string>>((acc, token) => {
      if ((token.type === 'SPL' || token.type === 'FungibleToken') && token.id) {
        const assetId = toAssetId({
          chainId,
          assetNamespace: ASSET_NAMESPACE.splToken,
          assetReference: token.id,
        })
        acc[assetId] = token.balance
      }
      return acc
    }, {})

    balances[feeAssetId] = data.balance

    return { account, chainId, balances }
  }

  if (chainNamespace === CHAIN_NAMESPACE.Evm) {
    const balances = data.tokens.reduce<Record<string, string>>((acc, token) => {
      if (['ERC20', 'BEP20'].includes(token.type)) {
        const assetId = toAssetId({
          chainId,
          assetNamespace: token.type === 'BEP20' ? ASSET_NAMESPACE.bep20 : ASSET_NAMESPACE.erc20,
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
}

export const getAccountTool = {
  description: 'Get raw account balances in base units',
  inputSchema: getAccountSchema,
  execute: executeGetAccount,
}
