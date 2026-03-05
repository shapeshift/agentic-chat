import type { EvmSolanaNetwork } from '@shapeshiftoss/types'
import { chainIdToNetwork, EVM_SOLANA_NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { calculateUsdValue, fromBaseUnit, toBigInt } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

import { getAssetPrices } from '../../lib/asset/prices'
import { getSafeAddressForChain } from '../../utils/walletContextSimple'
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

export async function executeVaultBalance(
  input: VaultBalanceInput,
  walletContext?: WalletContext
): Promise<VaultBalanceOutput> {
  // Build list of networks to query with their per-chain Safe addresses
  const networksWithAddresses: Array<{ network: EvmSolanaNetwork; safeAddress: string; chainId: string }> = []

  if (input.network) {
    const numericChainId = Number(networkToChainIdMap[input.network].split(':').pop())
    const safeAddress = getSafeAddressForChain(walletContext, numericChainId)
    if (!safeAddress) {
      throw new Error(
        `No Safe vault found on ${input.network}. A Safe smart account is deployed automatically when you create your first automated order.`
      )
    }
    networksWithAddresses.push({
      network: input.network,
      safeAddress,
      chainId: networkToChainIdMap[input.network],
    })
  } else {
    // Query all deployed chains
    const deploymentState = walletContext?.safeDeploymentState
    if (!deploymentState || Object.keys(deploymentState).length === 0) {
      throw new Error(
        'No Safe vault found. A Safe smart account is deployed automatically when you create your first automated order.'
      )
    }
    for (const [numericChainIdStr, state] of Object.entries(deploymentState)) {
      if (!state.safeAddress || !state.isDeployed) continue
      const numericChainId = Number(numericChainIdStr)
      const network = chainIdToNetwork[`eip155:${numericChainId}`] as EvmSolanaNetwork | undefined
      if (!network || network === 'solana') continue
      networksWithAddresses.push({
        network,
        safeAddress: state.safeAddress,
        chainId: `eip155:${numericChainId}`,
      })
    }
    if (networksWithAddresses.length === 0) {
      throw new Error(
        'No Safe vault found on any network. A Safe smart account is deployed automatically when you create your first automated order.'
      )
    }
  }

  const allBalances: VaultBalanceEntry[] = []
  let totalUsd = new BigNumber(0)

  // Use the first Safe address as the representative address for the response
  const primarySafeAddress = networksWithAddresses[0]!.safeAddress

  const results = await Promise.all(
    networksWithAddresses.map(async ({ network, safeAddress, chainId }) => {
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
            if (!asset || toBigInt(baseUnitValue) === 0n) return null

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
    safeAddress: primarySafeAddress,
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
