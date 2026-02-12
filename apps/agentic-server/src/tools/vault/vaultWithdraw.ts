import { fromAssetId } from '@shapeshiftoss/caip'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { validateSufficientBalance } from '../../utils/balanceHelpers'
import { getAddressForChain } from '../../utils/walletContextSimple'
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
  const safeAddress = walletContext?.safeAddress
  if (!safeAddress) {
    throw new Error(
      'No Safe vault found. A Safe smart account is deployed automatically when you create your first automated order.'
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

  const { NETWORK_TO_CHAIN_ID } = await import('../../lib/cow/types')
  const chainId = NETWORK_TO_CHAIN_ID[input.network]!

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

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

Default: Respond with one brief, natural sentence like:
- "Here's your vault withdrawal"
- "I've prepared the withdrawal for you"

This executes a Safe transaction (you sign as the Safe owner) to transfer tokens from the vault to your EOA wallet.

Only elaborate if the user asks about something not shown in the card.`,
  inputSchema: vaultWithdrawSchema,
  execute: executeVaultWithdraw,
}
