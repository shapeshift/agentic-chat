import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

import { resolveCowTokenAddress } from '../../lib/composableCow'
import { COW_VAULT_RELAYER_ADDRESS, prepareCowLimitOrder } from '../../lib/cow'
import type { CowOrderSigningData } from '../../lib/cow/types'
import { cowSupportedNetworkSchema, getCowExplorerUrl, NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import type { TransactionData } from '../../lib/schemas/swapSchemas'
import { getAllowance } from '../../utils'
import { buildApprovalTransaction } from '../../utils/approvalHelpers'
import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { getAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const createLimitOrderSchema = z.object({
  sellAsset: z.string().describe('Token symbol or name to sell (e.g., "USDC", "WETH")'),
  buyAsset: z.string().describe('Token symbol or name to buy (e.g., "USDC", "WETH")'),
  network: cowSupportedNetworkSchema.describe('Network for the limit order'),
  sellAmount: z
    .string()
    .describe(
      'Amount to sell in TOKEN units, not USD (e.g., "100" for 100 USDC, "0.5" for 0.5 WETH). If the user specified a USD dollar amount, convert to token units first using getAssetPricesTool and mathCalculatorTool.'
    ),
  limitPrice: z
    .string()
    .describe(
      'How much buyAsset you receive per 1 sellAsset. "sell A when worth X B" → limitPrice=X. Example: "worth 2 USDT" → "2"'
    ),
  expirationHours: z
    .number()
    .min(1)
    .max(8760)
    .optional()
    .default(168)
    .describe('Hours until order expires. Default is 168 (7 days). Max is 8760 (365 days).'),
})

export type CreateLimitOrderInput = z.infer<typeof createLimitOrderSchema>

export interface LimitOrderSummary {
  sellAsset: {
    symbol: string
    amount: string
  }
  buyAsset: {
    symbol: string
    estimatedAmount: string
  }
  network: string
  limitPrice: string
  expiresAt: string
  provider: 'cow'
}

export interface CreateLimitOrderOutput {
  summary: LimitOrderSummary
  signingData: CowOrderSigningData
  orderParams: {
    sellToken: string
    buyToken: string
    sellAmount: string
    buyAmount: string
    validTo: number
    receiver: string
    chainId: number
  }
  needsApproval: boolean
  approvalTx?: TransactionData
  approvalTarget: string
  trackingUrl: string
}

function calculateBuyAmount(buyAsset: Asset, sellAmount: string, limitPrice: string): string {
  const buyAmountHuman = new BigNumber(sellAmount).times(limitPrice)
  if (buyAmountHuman.isNaN()) {
    throw new Error('Invalid sellAmount or limitPrice')
  }
  return toBaseUnit(buyAmountHuman.toFixed(buyAsset.precision), buyAsset.precision)
}

export async function executeCreateLimitOrder(
  input: CreateLimitOrderInput,
  walletContext?: WalletContext
): Promise<CreateLimitOrderOutput> {
  const expirationSeconds = input.expirationHours * 60 * 60

  // Resolve assets on the specified network
  const [sellAsset, buyAsset] = await Promise.all([
    resolveAsset({ symbolOrName: input.sellAsset, network: input.network }, walletContext),
    resolveAsset({ symbolOrName: input.buyAsset, network: input.network }, walletContext),
  ])

  // Get numeric chain ID directly from network (Zod schema guarantees valid network)
  const evmChainId = NETWORK_TO_CHAIN_ID[input.network]!

  // Get user address for this chain
  const userAddress = getAddressForChain(walletContext, sellAsset.chainId)

  // Native token validation - CoW Protocol requires ERC20 tokens for selling
  const isNativeSellToken = isNativeToken(sellAsset)
  const isNativeBuyToken = isNativeToken(buyAsset)

  // Block native token as sell asset - CoW requires ERC20 tokens for selling
  if (isNativeSellToken) {
    const nativeSymbol = sellAsset.symbol
    throw new Error(
      `Native ${nativeSymbol} cannot be used as sell asset for limit orders. ` +
        `CoW Protocol requires ERC20 tokens. Please wrap your ${nativeSymbol} to W${nativeSymbol} first, ` +
        `or select W${nativeSymbol} as the sell asset.`
    )
  }

  // Get token addresses after validation
  const sellToken = fromAssetId(sellAsset.assetId).assetReference
  const buyToken = resolveCowTokenAddress(buyAsset, isNativeBuyToken)

  // Calculate amounts in base units
  const sellAmountBaseUnit = toBaseUnit(input.sellAmount, sellAsset.precision)
  const buyAmountBaseUnit = calculateBuyAmount(buyAsset, input.sellAmount, input.limitPrice)

  // Get approval target (CoW VaultRelayer contract - same address across all chains)
  const approvalTarget = COW_VAULT_RELAYER_ADDRESS

  // Check allowance for sell token
  const { isApprovalRequired: needsApproval } = await getAllowance({
    amount: sellAmountBaseUnit,
    asset: sellAsset,
    from: userAddress,
    spender: approvalTarget,
  })

  // Build approval transaction if needed
  const approvalTx = buildApprovalTransaction(needsApproval, sellAsset, approvalTarget, sellAmountBaseUnit, userAddress)

  // Prepare the order for signing
  const orderResult = prepareCowLimitOrder({
    sellToken,
    buyToken,
    sellAmount: sellAmountBaseUnit,
    buyAmount: buyAmountBaseUnit,
    userAddress,
    chainId: evmChainId,
    expirationSeconds,
    receiver: userAddress,
  })

  // Calculate estimated buy amount in human-readable format using BigNumber for precision
  const estimatedBuyAmount = new BigNumber(input.sellAmount).times(input.limitPrice).toFixed(6)

  const summary: LimitOrderSummary = {
    sellAsset: {
      symbol: sellAsset.symbol,
      amount: input.sellAmount,
    },
    buyAsset: {
      symbol: buyAsset.symbol,
      estimatedAmount: estimatedBuyAmount,
    },
    network: input.network,
    limitPrice: input.limitPrice,
    expiresAt: orderResult.expiresAt,
    provider: 'cow',
  }

  return {
    summary,
    signingData: orderResult.signingData,
    orderParams: {
      sellToken,
      buyToken,
      sellAmount: sellAmountBaseUnit,
      buyAmount: buyAmountBaseUnit,
      validTo: orderResult.orderToSign.validTo,
      receiver: userAddress,
      chainId: evmChainId,
    },
    needsApproval,
    approvalTx,
    approvalTarget,
    trackingUrl: getCowExplorerUrl('pending'),
  }
}

export const createLimitOrderTool = {
  description: `Create a limit order to trade at a specific price. Limit orders execute when the market reaches your target price.

UI CARD DISPLAYS: order details (sell/buy assets, amounts), limit price, expiration time, and signing button.

IMPORTANT:
- Limit orders require EIP-712 signature (gasless, off-chain)
- Both assets must be on the same EVM network
- Currently supports: Ethereum, Gnosis, Arbitrum
- Order executes automatically when market price reaches limit
- If user specifies total amounts (e.g., "10 USDC for 20 USDT"), use the maths tool to calculate limitPrice (20÷10=2)`,
  inputSchema: createLimitOrderSchema,
  execute: executeCreateLimitOrder,
}
