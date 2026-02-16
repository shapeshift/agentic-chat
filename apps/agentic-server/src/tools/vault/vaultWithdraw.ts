import { fromAssetId } from '@shapeshiftoss/caip'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { validateSufficientBalance } from '../../utils/balanceHelpers'
import { getAddressForChain, getSafeAddressForChain, isSafeReadyOnChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const vaultWithdrawSchema = z.object({
  asset: z.string().describe('Token symbol or name to withdraw (e.g., "WETH", "USDC")'),
  amount: z.string().describe('Amount to withdraw in human-readable format (e.g., "1" for 1 WETH)'),
  network: z.enum(['ethereum', 'gnosis', 'arbitrum']).describe('Network for the withdrawal'),
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
}

export async function executeVaultWithdraw(
  input: VaultWithdrawInput,
  walletContext?: WalletContext
): Promise<VaultWithdrawOutput> {
  const chainId = NETWORK_TO_CHAIN_ID[input.network]!
  const safeAddress = getSafeAddressForChain(walletContext, chainId)
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

  await validateSufficientBalance(safeAddress, asset, input.amount)

  const isNative = isNativeToken(asset)
  const amountBaseUnit = toBaseUnit(input.amount, asset.precision)

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
      args: [getAddress(toAddress), BigInt(amountBaseUnit)],
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
  }
}

export const vaultWithdrawTool = {
  description: `Withdraw tokens from the Safe automation vault back to your wallet.

UI CARD DISPLAYS: withdrawal amount, asset, vault address, and destination wallet.

IMPORTANT: Do NOT write any response text alongside this tool call. Wait for the tool result before responding. If the tool succeeds, the UI card will show the result — supplement it with one brief sentence, do not duplicate card data. If the tool fails, tell the user what went wrong and suggest alternatives.

This executes a Safe transaction (you sign as the Safe owner) to transfer tokens from the vault to your EOA wallet.`,
  inputSchema: vaultWithdrawSchema,
  execute: executeVaultWithdraw,
}
