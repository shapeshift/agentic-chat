import { toBigInt, toBaseUnit } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

import { getSimplePrices } from '../../lib/asset/coingecko'
import {
  buildCreateConditionalOrderTx,
  computeConditionalOrderHash,
  COW_VAULT_RELAYER_ADDRESS,
  DEFAULT_APP_DATA,
  encodeStopLossStaticData,
  generateOrderSalt,
  getChainlinkOracle,
  resolveCowTokenAddress,
  STOP_LOSS_HANDLER_ADDRESS,
} from '../../lib/composableCow'
import type { ConditionalOrderParams } from '../../lib/composableCow'
import { cowSupportedNetworkSchema, NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import type { TransactionData } from '../../lib/schemas/swapSchemas'
import { getAllowance } from '../../utils'
import { toChecksumAddress } from '../../utils/addressValidation'
import { buildApprovalTransaction } from '../../utils/approvalHelpers'
import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { calculateSafeVaultDeposit } from '../../utils/safeVaultDeposit'
import { getAddressForChain, getSafeAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

function formatPrice(price: number): string {
  if (price >= 0.01) return price.toFixed(2)
  if (price === 0) return '0'
  return price.toPrecision(4)
}

export const createStopLossSchema = z.object({
  sellAsset: z
    .string()
    .describe(
      'Token symbol or name to sell when price drops (e.g., "WETH", "LINK"). Must be an ERC20 token — native tokens like ETH must be wrapped to WETH first.'
    ),
  buyAsset: z
    .string()
    .describe('Token symbol or name to receive (e.g., "USDC", "USDT"). Usually a stablecoin for stop-losses.'),
  network: cowSupportedNetworkSchema.describe('Network for the stop-loss order'),
  sellAmount: z
    .string()
    .refine(val => !/^\d{15,}/.test(val.trim()), {
      message:
        'sellAmount looks like a base-unit value (15+ digits). Use human-readable token amounts (e.g. "1" for 1 WETH, not "1000000000000000000").',
    })
    .describe(
      'Amount to sell in TOKEN units, not USD (e.g., "1" for 1 WETH, "230" for 230 ARB, "100000" for 100000 PEPE). Never pass base units even if precision is 18 (e.g., not "230000000000000000000"). No commas, dollar signs, or token symbols. If the user specified a USD dollar amount, convert to token units first using getAssetPricesTool and mathCalculatorTool.'
    ),
  triggerPrice: z
    .string()
    .describe(
      'USD price at which to trigger the sell as a plain number. Must be below current market price. Example: if ETH is $3500 and you want to sell at $3000, triggerPrice is "3000"'
    ),
  expirationDays: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .default(30)
    .describe('Days until the stop-loss expires. Default is 30. Max is 30.'),
})

export type CreateStopLossInput = z.infer<typeof createStopLossSchema>

export interface StopLossSummary {
  sellAsset: { symbol: string; amount: string }
  buyAsset: { symbol: string; estimatedAmount: string }
  network: string
  triggerPrice: string
  currentPrice: string
  priceDistancePercent: string
  expiresAt: string
  provider: 'cow'
}

export interface CreateStopLossOutput {
  summary: StopLossSummary
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  needsApproval: boolean
  approvalTx?: TransactionData
  approvalTarget: string
  safeAddress: string
  orderHash: string
  conditionalOrderParams: ConditionalOrderParams
  needsDeposit: boolean
  depositTx?: TransactionData
  sellTokenAddress: string
  buyTokenAddress: string
  sellAmountBaseUnit: string
  sellPrecision: number
  buyPrecision: number
  validTo: number
}

const SLIPPAGE_BUFFER = 0.98 // 2% slippage buffer
const MAX_ORACLE_STALENESS = BigInt(24 * 60 * 60) // 24 hours — must exceed Chainlink's longest heartbeat (USDC/USD = 24h)

export async function executeCreateStopLoss(
  input: CreateStopLossInput,
  walletContext?: WalletContext
): Promise<CreateStopLossOutput> {
  const evmChainId = NETWORK_TO_CHAIN_ID[input.network]!

  // Validate Safe address is available on the target chain
  const safeAddress = await getSafeAddressForChain(walletContext, evmChainId)
  if (!safeAddress) {
    throw new Error(
      'Stop-loss orders require a Safe smart account. A Safe will be deployed automatically when you submit this order.'
    )
  }

  // Resolve assets on the specified network
  const [sellAsset, buyAsset] = await Promise.all([
    resolveAsset({ symbolOrName: input.sellAsset, network: input.network }, walletContext),
    resolveAsset({ symbolOrName: input.buyAsset, network: input.network }, walletContext),
  ])
  // Validate the user has a connected wallet on this chain
  getAddressForChain(walletContext, sellAsset.chainId)

  // Reject native tokens — CoW Protocol requires ERC20 tokens
  if (isNativeToken(sellAsset)) {
    const nativeSymbol = sellAsset.symbol
    throw new Error(
      `Native ${nativeSymbol} cannot be used as sell asset for stop-loss orders. ` +
        `CoW Protocol requires ERC20 tokens. Please wrap your ${nativeSymbol} to W${nativeSymbol} first.`
    )
  }

  const sellOracle = getChainlinkOracle(evmChainId, sellAsset.symbol)
  const buyOracle = getChainlinkOracle(evmChainId, buyAsset.symbol)

  if (!sellOracle) {
    throw new Error(
      `No Chainlink price oracle available for ${sellAsset.symbol} on ${input.network}. ` +
        `Stop-loss orders require on-chain price feeds for condition verification.`
    )
  }
  if (!buyOracle) {
    throw new Error(
      `No Chainlink price oracle available for ${buyAsset.symbol} on ${input.network}. ` +
        `Stop-loss orders require on-chain price feeds for condition verification.`
    )
  }

  // Get current USD prices for both tokens
  const priceResults = await getSimplePrices([sellAsset.assetId, buyAsset.assetId])
  const sellAssetPrice = priceResults.find(p => p.assetId === sellAsset.assetId)
  const buyAssetPrice = priceResults.find(p => p.assetId === buyAsset.assetId)

  const currentSellPrice = Number(sellAssetPrice?.price ?? '0')
  const currentBuyPrice = Number(buyAssetPrice?.price ?? '0')

  if (currentSellPrice <= 0) {
    throw new Error(`Could not fetch current price for ${sellAsset.symbol}`)
  }
  if (currentBuyPrice <= 0) {
    throw new Error(`Could not fetch current price for ${buyAsset.symbol}`)
  }

  const triggerPriceNum = Number(input.triggerPrice)
  if (Number.isNaN(triggerPriceNum) || triggerPriceNum <= 0) {
    throw new Error(`Invalid trigger price: "${input.triggerPrice}". Must be a positive number.`)
  }
  if (triggerPriceNum >= currentSellPrice) {
    throw new Error(
      `Trigger price ($${input.triggerPrice}) must be below current price ($${formatPrice(currentSellPrice)}). ` +
        `A stop-loss triggers when price drops to your threshold.`
    )
  }

  // Calculate buy amount at trigger price with slippage
  const limitPriceRatio = new BigNumber(input.triggerPrice).div(currentBuyPrice)
  const buyAmountHuman = new BigNumber(input.sellAmount).times(limitPriceRatio).times(SLIPPAGE_BUFFER)
  const buyAmountBaseUnit = toBaseUnit(
    buyAmountHuman.toFixed(buyAsset.precision, BigNumber.ROUND_DOWN),
    buyAsset.precision
  )

  // Get token addresses
  const sellTokenAddress = resolveCowTokenAddress(sellAsset, false)
  const buyTokenAddress = resolveCowTokenAddress(buyAsset, isNativeToken(buyAsset))

  const sellAmountBaseUnit = toBaseUnit(input.sellAmount, sellAsset.precision)
  const buyAmountStr = buyAmountBaseUnit
  // CoW StopLoss contract normalizes both oracle prices to 18 decimals before comparing:
  // basePrice * 1e18 / quotePrice <= strike
  // so the strike must be scaled to 1e18 regardless of oracle decimals
  const COW_STOP_LOSS_SCALING_FACTOR = 18
  const strikePriceStr = new BigNumber(input.triggerPrice)
    .div(currentBuyPrice)
    .times(new BigNumber(10).pow(COW_STOP_LOSS_SCALING_FACTOR))
    .integerValue(BigNumber.ROUND_DOWN)
    .toString()

  console.log('[createStopLoss] BigInt candidates:', {
    sellAmountBaseUnit,
    buyAmountBaseUnit: buyAmountStr,
    strikePrice: strikePriceStr,
    sellOracleDecimals: sellOracle.decimals,
  })

  const strikePrice = new BigNumber(strikePriceStr)

  const { totalNeeded, needsDeposit, depositTx } = await calculateSafeVaultDeposit({
    walletContext,
    safeAddress,
    sellAsset,
    sellAmountBaseUnit,
    evmChainId,
    sellTokenAddress,
  })

  // Check allowance (from Safe → VaultRelayer) against total needed
  const approvalTarget = COW_VAULT_RELAYER_ADDRESS
  const { isApprovalRequired: needsApproval } = await getAllowance({
    amount: totalNeeded.toString(),
    asset: sellAsset,
    from: safeAddress,
    spender: approvalTarget,
  })

  const approvalTx = buildApprovalTransaction(
    needsApproval,
    sellAsset,
    approvalTarget,
    totalNeeded.toString(),
    safeAddress
  )

  // Build ComposableCoW conditional order
  const salt = generateOrderSalt(safeAddress, sellTokenAddress, buyTokenAddress)

  const validTo = Math.floor(Date.now() / 1000) + input.expirationDays * 86400

  const staticData = encodeStopLossStaticData({
    sellToken: sellTokenAddress,
    buyToken: buyTokenAddress,
    sellAmount: toBigInt(sellAmountBaseUnit),
    buyAmount: toBigInt(buyAmountBaseUnit),
    appData: DEFAULT_APP_DATA,
    receiver: toChecksumAddress(safeAddress),
    isSellOrder: true,
    isPartiallyFillable: true,
    validTo,
    sellTokenPriceOracle: toChecksumAddress(sellOracle.address),
    buyTokenPriceOracle: toChecksumAddress(buyOracle.address),
    strike: toBigInt(strikePrice.toString()),
    maxTimeSinceLastOracleUpdate: MAX_ORACLE_STALENESS,
  })

  const conditionalOrderParams: ConditionalOrderParams = {
    handler: STOP_LOSS_HANDLER_ADDRESS,
    salt,
    staticInput: staticData,
  }

  const orderHash = computeConditionalOrderHash(conditionalOrderParams)
  const safeTransaction = buildCreateConditionalOrderTx(conditionalOrderParams)

  const priceDistancePercent = new BigNumber(currentSellPrice - triggerPriceNum)
    .div(currentSellPrice)
    .times(100)
    .toFixed(1)

  const estimatedBuyAmount = new BigNumber(input.sellAmount).times(limitPriceRatio).toFixed(6)

  const expirationSeconds = input.expirationDays * 24 * 60 * 60
  const expiresAt = new Date(Date.now() + expirationSeconds * 1000).toISOString()

  const summary: StopLossSummary = {
    sellAsset: { symbol: sellAsset.symbol, amount: input.sellAmount },
    buyAsset: { symbol: buyAsset.symbol, estimatedAmount: estimatedBuyAmount },
    network: input.network,
    triggerPrice: input.triggerPrice,
    currentPrice: formatPrice(currentSellPrice),
    priceDistancePercent,
    expiresAt,
    provider: 'cow',
  }

  return {
    summary,
    safeTransaction: { ...safeTransaction, chainId: evmChainId },
    needsApproval,
    approvalTx,
    approvalTarget,
    safeAddress,
    orderHash,
    conditionalOrderParams,
    needsDeposit,
    depositTx,
    sellTokenAddress,
    buyTokenAddress,
    sellAmountBaseUnit,
    sellPrecision: sellAsset.precision,
    buyPrecision: buyAsset.precision,
    validTo,
  }
}

export const createStopLossTool = {
  description: `Create a stop-loss order to automatically sell a token when its price drops to a threshold. The order is registered on-chain via ComposableCoW through a Safe smart account. CoW's watchtower network monitors the Chainlink oracle and executes the order when triggered.

UI CARD DISPLAYS: order details (sell/buy assets, amounts), trigger price vs current price with % distance, Safe address, and multi-step transaction flow.

IMPORTANT: Do NOT write any response text alongside this tool call. Wait for the tool result before responding. If the tool succeeds, the UI card will show the result — supplement it with one brief sentence, do not duplicate card data. If the tool fails, tell the user what went wrong and suggest alternatives.

IMPORTANT:
- The user does NOT need tokens in their Safe wallet beforehand — this tool automatically handles depositing tokens from the user's connected wallet into the Safe as part of the multi-step execution flow
- Requires a Safe smart account (deployed automatically on first use, works with any connected wallet)
- Stop-loss is submitted as an on-chain transaction via Safe → ComposableCoW
- Trigger price must be BELOW current market price
- Both assets must be on the same EVM network (Ethereum, Gnosis, Arbitrum)
- Only tokens with Chainlink price feeds are supported
- CoW's watchtower monitors the order and executes when Chainlink reports price <= trigger
- 2% slippage buffer applied to buy amount
- Native tokens (ETH) cannot be used directly — wrap to WETH first
- Use the maths tool if you need to calculate trigger prices from percentages`,
  inputSchema: createStopLossSchema,
  execute: executeCreateStopLoss,
  experimental_toToolResultContent: (result: CreateStopLossOutput) => {
    const llmVisible = { ...result }
    delete llmVisible.sellAmountBaseUnit
    delete llmVisible.sellPrecision
    delete llmVisible.buyPrecision
    return [{ type: 'text' as const, text: JSON.stringify(llmVisible) }]
  },
}
