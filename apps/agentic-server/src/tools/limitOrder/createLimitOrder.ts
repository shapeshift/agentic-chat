import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

import { getSimplePrices } from '../../lib/asset/coingecko'
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
    .refine(val => !/^\d{15,}/.test(val.trim()), {
      message:
        'sellAmount looks like a base-unit value (15+ digits). Use human-readable token amounts (e.g. "230" for 230 ARB, not "230000000000000000000").',
    })
    .describe(
      'Amount to sell in TOKEN units, not USD (e.g., "100" for 100 USDC, "230" for 230 ARB). Never pass base units even if precision is 18 (e.g., not "230000000000000000000"). If the user specified a USD dollar amount, convert to token units first using getAssetPricesTool and mathCalculatorTool.'
    ),
  limitPrice: z
    .string()
    .describe(
      'How much buyAsset you receive per 1 sellAsset. NEVER invert — for sub-dollar tokens (e.g. ARB at $0.50 USD selling for USDC), limitPrice ≈ 0.50, NOT 2. "sell A when worth X B" → limitPrice=X. Example: "worth 2 USDT" → "2". For percentage-based requests ("sell when up 5%"), compute: currentPricePerToken × (1 + pct/100). Use getAssetPrices if uncertain.'
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

  const limitPriceNum = Number(input.limitPrice)
  if (!Number.isFinite(limitPriceNum) || limitPriceNum <= 0) {
    throw new Error(`Invalid limitPrice "${input.limitPrice}". It must be a positive number.`)
  }

  // Sanity-check limitPrice against current market rate to catch LLM inversion/base-unit errors
  const priceResults = await getSimplePrices([sellAsset.assetId, buyAsset.assetId])
  const sellUsdPrice = Number(priceResults.find(p => p.assetId === sellAsset.assetId)?.price ?? '0')
  const buyUsdPrice = Number(priceResults.find(p => p.assetId === buyAsset.assetId)?.price ?? '0')
  if (sellUsdPrice > 0 && buyUsdPrice > 0) {
    const marketLimitPrice = sellUsdPrice / buyUsdPrice
    const ratio = limitPriceNum / marketLimitPrice
    if (!Number.isFinite(ratio) || ratio <= 0) {
      throw new Error(
        `Invalid limitPrice "${input.limitPrice}" for market comparison. ` +
          `Expected a positive ${buyAsset.symbol}/${sellAsset.symbol} price.`
      )
    }
    const logRatio = Math.abs(Math.log10(ratio))
    const isNearUsdPrice = (usdPrice: number) => usdPrice > 0 && Math.abs(limitPriceNum - usdPrice) / usdPrice <= 0.25

    // Guard likely "USD price leaked into pair price" mistakes.
    // Example: ARB->EUL should be ~0.086 EUL/ARB, but passing 1.39 (EUL USD) is >10x off.
    if (logRatio > 1 && (isNearUsdPrice(sellUsdPrice) || isNearUsdPrice(buyUsdPrice))) {
      throw new Error(
        `limitPrice ${input.limitPrice} appears to be a USD token price, not the pair price. ` +
          `Expected approximately ${marketLimitPrice.toFixed(6)} ${buyAsset.symbol}/${sellAsset.symbol} ` +
          `(1 ${sellAsset.symbol} = X ${buyAsset.symbol}).`
      )
    }

    if (logRatio > 3) {
      throw new Error(
        `limitPrice ${input.limitPrice} is more than 1000× from the market rate (~${marketLimitPrice.toFixed(6)} ${buyAsset.symbol}/${sellAsset.symbol}). ` +
          `Did you invert the price or pass a base-unit value? For ${sellAsset.symbol} at $${sellUsdPrice} selling for ${buyAsset.symbol}, limitPrice should be ~${marketLimitPrice.toFixed(6)}.`
      )
    }
    if (logRatio > 1) {
      console.warn('[createLimitOrder] limitPrice sanity check: suspicious deviation', {
        inputLimitPrice: input.limitPrice,
        marketLimitPrice,
        ratio,
        sellAsset: sellAsset.symbol,
        buyAsset: buyAsset.symbol,
      })
    }
  }

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
- If user specifies total amounts (e.g., "10 USDC for 20 USDT"), use the maths tool to calculate limitPrice (20÷10=2)
- For percentage-based requests ("sell when up X%"), compute limitPrice = currentPricePerToken × (1 + X/100) using getAssetPrices and the maths tool`,
  inputSchema: createLimitOrderSchema,
  execute: executeCreateLimitOrder,
  experimental_toToolResultContent: (result: CreateLimitOrderOutput) => {
    const llmSigningData: Pick<CowOrderSigningData, 'domain' | 'types' | 'primaryType'> = {
      domain: result.signingData.domain,
      types: result.signingData.types,
      primaryType: result.signingData.primaryType,
    }
    const llmVisible = {
      summary: result.summary,
      signingData: llmSigningData,
      needsApproval: result.needsApproval,
      approvalTx: result.approvalTx,
      approvalTarget: result.approvalTarget,
      trackingUrl: result.trackingUrl,
    }
    return [{ type: 'text' as const, text: JSON.stringify(llmVisible) }]
  },
}
