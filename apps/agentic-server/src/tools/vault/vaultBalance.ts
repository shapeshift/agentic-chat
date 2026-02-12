import type { EvmSolanaNetwork } from '@shapeshiftoss/types'
import { chainIdToNetwork, EVM_SOLANA_NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { calculateUsdValue, fromBaseUnit } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

import { getAssetPrices } from '../../lib/asset/prices'
import type { WalletContext } from '../../utils/walletContextSimple'
import { executeGetAccount } from '../getAccount'

export const vaultBalanceSchema = z.object({
  network: z
    .enum(EVM_SOLANA_NETWORKS)
    .optional()
    .describe('Network to check vault balance on. Omit to check all EVM networks.'),
})

export type VaultBalanceInput = z.infer<typeof vaultBalanceSchema>

export interface VaultBalanceEntry {
  symbol: string
  name: string
  assetId: string
  cryptoAmount: string
  usdAmount: string
  network: string
}

export interface VaultBalanceOutput {
  safeAddress: string
  balances: VaultBalanceEntry[]
  totalUsd: string
}

const EVM_NETWORKS = EVM_SOLANA_NETWORKS.filter(n => n !== 'solana') as EvmSolanaNetwork[]

export async function executeVaultBalance(
  input: VaultBalanceInput,
  walletContext?: WalletContext
): Promise<VaultBalanceOutput> {
  const safeAddress = walletContext?.safeAddress
  if (!safeAddress) {
    throw new Error(
      'No Safe vault found. A Safe smart account is deployed automatically when you create your first automated order.'
    )
  }

  const networks = input.network ? [input.network] : EVM_NETWORKS

  const allBalances: VaultBalanceEntry[] = []
  let totalUsd = new BigNumber(0)

  const results = await Promise.all(
    networks.map(async network => {
      const chainId = networkToChainIdMap[network]
      try {
        const { balances } = await executeGetAccount({ address: safeAddress, network })
        const assetIds = Object.keys(balances)
        if (assetIds.length === 0) return []

        const assets = await getAssetPrices(assetIds)
        const assetMap = new Map(assets.map(a => [a.assetId, a]))

        return assetIds
          .map(assetId => {
            const baseUnitValue = balances[assetId] || '0'
            const asset = assetMap.get(assetId)
            if (!asset || BigInt(baseUnitValue) === 0n) return null

            const cryptoAmount = fromBaseUnit(baseUnitValue, asset.precision)
            const usdAmount = calculateUsdValue(cryptoAmount, asset.price)

            return {
              symbol: asset.symbol,
              name: asset.name,
              assetId: asset.assetId,
              cryptoAmount,
              usdAmount,
              network: chainIdToNetwork[chainId] ?? network,
            }
          })
          .filter((b): b is NonNullable<typeof b> => b !== null)
      } catch {
        return []
      }
    })
  )

  for (const networkBalances of results) {
    for (const balance of networkBalances) {
      allBalances.push(balance)
      totalUsd = totalUsd.plus(balance.usdAmount)
    }
  }

  allBalances.sort((a, b) => new BigNumber(b.usdAmount).minus(a.usdAmount).toNumber())

  return {
    safeAddress,
    balances: allBalances,
    totalUsd: totalUsd.toFixed(2),
  }
}

export const vaultBalanceTool = {
  description: `Check token balances in the Safe automation vault.

No UI card - format and present the data in your response.

Shows what tokens are currently held in the Safe smart account. Tokens must be deposited into the Safe before automated orders (stop-loss, TWAP, DCA) can execute.`,
  inputSchema: vaultBalanceSchema,
  execute: executeVaultBalance,
}
