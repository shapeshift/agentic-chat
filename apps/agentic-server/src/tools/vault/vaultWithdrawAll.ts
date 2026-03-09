import { fromAssetId } from '@shapeshiftoss/caip'
import { AssetService, fromBaseUnit, getFeeAssetIdByChainId, toBigInt, toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getAllCommittedAmounts } from '../../utils/committedBalances'
import { getSafeAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

import { executeVaultBalance } from './vaultBalance'
import type { VaultBalanceEntry } from './vaultBalance'

export const vaultWithdrawAllSchema = z.object({
  network: z
    .enum(['ethereum', 'gnosis', 'arbitrum'])
    .optional()
    .describe('Network to withdraw all tokens from. If omitted, withdraws from all chains with balances.'),
  ignoreActiveOrders: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, withdraw even if funds are committed to active TWAP/stop-loss orders (may break those orders)'),
})

export type VaultWithdrawAllInput = z.infer<typeof vaultWithdrawAllSchema>

interface ChainWithdrawal {
  network: string
  chainId: number
  safeAddress: string
  toAddress: string
  tokens: Array<{ symbol: string; amount: string; usdValue: string }>
  totalUsd: string
  safeBatchTransaction: Array<{ to: string; data: string; value: string }>
}

export interface VaultWithdrawAllOutput {
  withdrawals: ChainWithdrawal[]
  totalUsd: string
  warnings?: string[]
}

function buildTransferTransaction(
  balance: VaultBalanceEntry,
  toAddress: string,
  chainId: number
): { to: string; data: string; value: string } {
  const feeAssetId = getFeeAssetIdByChainId(`eip155:${chainId}`)
  const isNative = balance.assetId === feeAssetId

  const asset = AssetService.getInstance().getAsset(balance.assetId)
  const precision = asset?.precision ?? 18

  if (isNative) {
    return {
      to: getAddress(toAddress),
      data: '0x',
      value: toBaseUnit(balance.cryptoAmount, precision),
    }
  }

  const { assetReference: tokenAddress } = fromAssetId(balance.assetId)
  const amountBaseUnit = toBaseUnit(balance.cryptoAmount, precision)

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [getAddress(toAddress), toBigInt(amountBaseUnit)],
  })

  return {
    to: getAddress(tokenAddress),
    data,
    value: '0',
  }
}

export async function executeVaultWithdrawAll(
  input: VaultWithdrawAllInput,
  walletContext?: WalletContext
): Promise<VaultWithdrawAllOutput> {
  const vaultBalances = await executeVaultBalance({ network: input.network }, walletContext)

  if (vaultBalances.balances.length === 0) {
    throw new Error(
      input.network
        ? `No tokens found in the vault on ${input.network}. Nothing to withdraw.`
        : 'No tokens found in the vault on any chain. Nothing to withdraw.'
    )
  }

  // Group balances by network
  const balancesByNetwork = new Map<string, VaultBalanceEntry[]>()
  for (const balance of vaultBalances.balances) {
    const networkBalances = balancesByNetwork.get(balance.network) ?? []
    networkBalances.push(balance)
    balancesByNetwork.set(balance.network, networkBalances)
  }

  const withdrawals: ChainWithdrawal[] = []
  let grandTotalUsd = 0
  const warnings: string[] = []

  for (const [network, balances] of balancesByNetwork) {
    const numericChainId = NETWORK_TO_CHAIN_ID[network]
    if (!numericChainId) continue

    const safeAddress = await getSafeAddressForChain(walletContext, numericChainId)
    if (!safeAddress) continue

    const caipChainId = `eip155:${numericChainId}`
    const toAddress = walletContext?.connectedWallets?.[caipChainId]?.address
    if (!toAddress) continue

    const committedAmounts = await getAllCommittedAmounts(walletContext, safeAddress, numericChainId)

    const filteredBalances: VaultBalanceEntry[] = []
    const transactions: { to: string; data: string; value: string }[] = []

    for (const balance of balances) {
      const feeAssetId = getFeeAssetIdByChainId(caipChainId)
      const isNative = balance.assetId === feeAssetId

      if (isNative) {
        filteredBalances.push(balance)
        transactions.push(buildTransferTransaction(balance, toAddress, numericChainId))
        continue
      }

      const { assetReference: tokenAddress } = fromAssetId(balance.assetId)
      const committed = committedAmounts.get(tokenAddress.toLowerCase()) ?? 0n

      if (committed > 0n) {
        const asset = AssetService.getInstance().getAsset(balance.assetId)
        const precision = asset?.precision ?? 18
        const committedHuman = fromBaseUnit(committed.toString(), precision)

        if (!input.ignoreActiveOrders) {
          const balanceBaseUnit = toBigInt(toBaseUnit(balance.cryptoAmount, precision))
          const adjusted = balanceBaseUnit > committed ? balanceBaseUnit - committed : 0n

          if (adjusted <= 0n) {
            warnings.push(
              `Skipped ${balance.symbol}: entire balance (${balance.cryptoAmount}) is committed to active orders.`
            )
            continue
          }

          const adjustedHuman = fromBaseUnit(adjusted.toString(), precision)
          const ratio = Number(adjusted) / Number(balanceBaseUnit)
          const adjustedUsd = (Number(balance.usdAmount) * ratio).toFixed(2)

          warnings.push(
            `${balance.symbol}: withdrawing ${adjustedHuman} of ${balance.cryptoAmount} ` +
              `(${committedHuman} committed to active orders).`
          )

          const adjustedBalance: VaultBalanceEntry = {
            ...balance,
            cryptoAmount: adjustedHuman,
            usdAmount: adjustedUsd,
          }
          filteredBalances.push(adjustedBalance)
          transactions.push(buildTransferTransaction(adjustedBalance, toAddress, numericChainId))
        } else {
          warnings.push(
            `Warning: ${committedHuman} ${balance.symbol} is committed to active TWAP/stop-loss orders. ` +
              `This withdrawal may cause those orders to fail.`
          )
          filteredBalances.push(balance)
          transactions.push(buildTransferTransaction(balance, toAddress, numericChainId))
        }
      } else {
        filteredBalances.push(balance)
        transactions.push(buildTransferTransaction(balance, toAddress, numericChainId))
      }
    }

    if (filteredBalances.length === 0) continue

    const chainTotalUsd = filteredBalances.reduce((sum, b) => sum + Number(b.usdAmount), 0)

    withdrawals.push({
      network,
      chainId: numericChainId,
      safeAddress,
      toAddress,
      tokens: filteredBalances.map(b => ({
        symbol: b.symbol,
        amount: b.cryptoAmount,
        usdValue: b.usdAmount,
      })),
      totalUsd: chainTotalUsd.toFixed(2),
      safeBatchTransaction: transactions,
    })

    grandTotalUsd += chainTotalUsd
  }

  if (withdrawals.length === 0) {
    if (warnings.length > 0) {
      throw new Error(
        `All vault tokens are committed to active TWAP/stop-loss orders. ` +
          `To withdraw anyway (which may break active orders), set ignoreActiveOrders to true.`
      )
    }
    throw new Error('Could not build withdrawal transactions. Please check your wallet connection.')
  }

  return {
    withdrawals,
    totalUsd: grandTotalUsd.toFixed(2),
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}

export const vaultWithdrawAllTool = {
  description: `Withdraw all tokens from the Safe vault to your wallet in a single transaction per chain.

UI CARD DISPLAYS: list of tokens being withdrawn per chain, amounts, and USD values.

IMPORTANT: Do NOT write any response text alongside this tool call. Wait for the tool result before responding. If the tool succeeds, the UI card will show the result — supplement it with one brief sentence, do not duplicate card data. If the tool fails, tell the user what went wrong and suggest alternatives.

Use this tool when:
- User wants to empty/drain their vault
- User asks to "withdraw everything" or "move all funds out"
- After fulfilled orders, user wants all vault funds back

ACTIVE ORDER PROTECTION: Tokens committed to active TWAP/stop-loss orders are excluded by default. Only excess funds are withdrawn. If the user explicitly wants everything (which may break orders), set ignoreActiveOrders to true.`,
  inputSchema: vaultWithdrawAllSchema,
  execute: executeVaultWithdrawAll,
}
