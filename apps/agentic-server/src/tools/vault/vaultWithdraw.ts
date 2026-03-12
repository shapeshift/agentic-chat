import { fromAssetId } from '@shapeshiftoss/caip'
import { fromBaseUnit, toBigInt, toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { cowSupportedNetworkSchema, NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { getBalance } from '../../utils/balanceHelpers'
import { getCommittedAmountForToken } from '../../utils/committedBalances'
import { getAddressForChain, getSafeAddressForChain, isSafeReadyOnChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const vaultWithdrawSchema = z.object({
  asset: z.string().describe('Token symbol or name to withdraw (e.g., "WETH", "USDC")'),
  amount: z.string().describe('Amount to withdraw in human-readable format (e.g., "1" for 1 WETH)'),
  network: cowSupportedNetworkSchema.describe('Network for the withdrawal'),
  ignoreActiveOrders: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, withdraw even if funds are committed to active TWAP/stop-loss orders (may break those orders)'),
})

export type VaultWithdrawInput = z.infer<typeof vaultWithdrawSchema>

export interface VaultWithdrawOutput {
  summary: {
    asset: { symbol: string; amount: string }
    network: string
    toAddress: string
    safeAddress: string
  }
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  warnings?: string[]
}

export async function executeVaultWithdraw(
  input: VaultWithdrawInput,
  walletContext?: WalletContext
): Promise<VaultWithdrawOutput> {
  const chainId = NETWORK_TO_CHAIN_ID[input.network]!
  const safeAddress = await getSafeAddressForChain(walletContext, chainId)
  if (!safeAddress) {
    throw new Error(
      'No Safe vault found. A Safe smart account is deployed automatically when you create your first automated order.'
    )
  }
  if (!isSafeReadyOnChain(walletContext, chainId)) {
    throw new Error(
      `Safe is not deployed on ${input.network}. Cannot withdraw on a chain where the Safe doesn't exist.`
    )
  }

  const asset = await resolveAsset({ symbolOrName: input.asset, network: input.network }, walletContext)
  const toAddress = getAddressForChain(walletContext, asset.chainId)

  const isNative = isNativeToken(asset)
  const amountBaseUnit = toBaseUnit(input.amount, asset.precision)
  const requestedBigInt = toBigInt(amountBaseUnit)
  const warnings: string[] = []

  const balance = await getBalance(safeAddress, asset)
  const balanceBigInt = toBigInt(balance)

  if (balanceBigInt < requestedBigInt) {
    const available = fromBaseUnit(balance, asset.precision)
    throw new Error(`Insufficient ${asset.symbol} balance. Required: ${input.amount}, Available: ${available}`)
  }

  if (!isNative) {
    const tokenAddress = fromAssetId(asset.assetId).assetReference
    const committedAmount = await getCommittedAmountForToken(walletContext, safeAddress, chainId, tokenAddress)

    if (committedAmount > 0n) {
      const available = balanceBigInt > committedAmount ? balanceBigInt - committedAmount : 0n
      const committedHuman = fromBaseUnit(committedAmount.toString(), asset.precision)

      if (!input.ignoreActiveOrders) {
        if (requestedBigInt > available) {
          const availableHuman = fromBaseUnit(available.toString(), asset.precision)
          throw new Error(
            `${committedHuman} ${asset.symbol} is committed to active TWAP/stop-loss orders. ` +
              `You can withdraw up to ${availableHuman} ${asset.symbol} without affecting active orders. ` +
              `To withdraw the full amount anyway (which may break active orders), set ignoreActiveOrders to true.`
          )
        }
      } else {
        warnings.push(
          `Warning: ${committedHuman} ${asset.symbol} is committed to active TWAP/stop-loss orders. ` +
            `This withdrawal may cause those orders to fail.`
        )
      }
    }
  }

  let safeTransaction: { to: string; data: string; value: string }

  if (isNative) {
    safeTransaction = {
      to: getAddress(toAddress),
      data: '0x',
      value: amountBaseUnit,
    }
  } else {
    const tokenAddress = fromAssetId(asset.assetId).assetReference
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [getAddress(toAddress), toBigInt(amountBaseUnit)],
    })

    safeTransaction = {
      to: getAddress(tokenAddress),
      data,
      value: '0',
    }
  }

  return {
    summary: {
      asset: { symbol: asset.symbol, amount: input.amount },
      network: input.network,
      toAddress,
      safeAddress,
    },
    safeTransaction: { ...safeTransaction, chainId },
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}

export const vaultWithdrawTool = {
  description: `Withdraw tokens from the Safe automation vault back to your wallet.

UI CARD DISPLAYS: withdrawal amount, asset, vault address, and destination wallet.

IMPORTANT: Do NOT write any response text alongside this tool call. Wait for the tool result before responding. If the tool succeeds, the UI card will show the result — supplement it with one brief sentence, do not duplicate card data. If the tool fails, tell the user what went wrong and suggest alternatives.

This executes a Safe transaction (you sign as the Safe owner) to transfer tokens from the vault to your EOA wallet.

ACTIVE ORDER PROTECTION: If the token has funds committed to active TWAP/stop-loss orders, the withdrawal will be blocked unless the user explicitly sets ignoreActiveOrders to true. Ask the user whether they want to withdraw only excess funds or force-withdraw everything.`,
  inputSchema: vaultWithdrawSchema,
  execute: executeVaultWithdraw,
}
