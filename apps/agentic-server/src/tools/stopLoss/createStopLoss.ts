import { assetIdToCoingecko, fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { getSimplePrices } from '../../lib/asset/coingecko'
import { COW_VAULT_RELAYER_ADDRESS, prepareCowLimitOrder } from '../../lib/cow'
import type { CowOrderSigningData } from '../../lib/cow/types'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getAllowance } from '../../utils'
import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { createTransaction } from '../../utils/transactionHelpers'
import { getAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

type TransactionData = {
  chainId: string
  data: string
  from: string
  to: string
  value: string
}

function buildApprovalTransaction(
  needsApproval: boolean,
  sellAsset: Asset,
  approvalTarget: string,
  sellAmountBaseUnit: string,
  userAddress: string
): TransactionData | undefined {
  if (!needsApproval) return undefined

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [getAddress(approvalTarget), BigInt(sellAmountBaseUnit)],
  })

  const tokenAddress = fromAssetId(sellAsset.assetId).assetReference

  return createTransaction({
    chainId: sellAsset.chainId,
    data,
    from: userAddress,
    to: tokenAddress,
    value: '0',
  })
}

export const createStopLossSchema = z.object({
  sellAsset: z.string().describe('Token symbol or name to sell when price drops (e.g., "WETH", "LINK")'),
  buyAsset: z
    .string()
    .describe('Token symbol or name to receive (e.g., "USDC", "USDT"). Usually a stablecoin for stop-losses.'),
  network: z.enum(['ethereum', 'gnosis', 'arbitrum']).describe('Network for the stop-loss order'),
  sellAmount: z.string().describe('Amount to sell in human-readable format (e.g., "1" for 1 WETH)'),
  triggerPrice: z
    .string()
    .describe(
      'USD price at which to trigger the sell. Must be below current market price. Example: if ETH is $3500 and you want to sell at $3000, triggerPrice is "3000"'
    ),
  expirationDays: z
    .number()
    .min(1)
    .max(365)
    .optional()
    .default(30)
    .describe('Days until the stop-loss expires. Default is 30. Max is 365.'),
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

export interface StopLossRegistration {
  id: string
  chainId: number
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  validTo: number
  triggerPrice: string
  currentPriceAtCreation: string
  sellTokenCoingeckoId: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmountHuman: string
  network: string
  appData: string
  receiver: string
  expiresAt: string
}

export interface CreateStopLossOutput {
  summary: StopLossSummary
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
  stopLossRegistration: StopLossRegistration
}

const SLIPPAGE_BUFFER = 0.98 // 2% slippage buffer

export async function executeCreateStopLoss(
  input: CreateStopLossInput,
  walletContext?: WalletContext
): Promise<CreateStopLossOutput> {
  const expirationSeconds = input.expirationDays * 24 * 60 * 60

  // Resolve assets on the specified network
  const [sellAsset, buyAsset] = await Promise.all([
    resolveAsset({ symbolOrName: input.sellAsset, network: input.network }, walletContext),
    resolveAsset({ symbolOrName: input.buyAsset, network: input.network }, walletContext),
  ])

  const evmChainId = NETWORK_TO_CHAIN_ID[input.network]!
  const userAddress = getAddressForChain(walletContext, sellAsset.chainId)

  // Native token validation - CoW Protocol requires ERC20 tokens for selling
  if (isNativeToken(sellAsset)) {
    const nativeSymbol = sellAsset.symbol
    throw new Error(
      `Native ${nativeSymbol} cannot be used as sell asset for stop-loss orders. ` +
        `CoW Protocol requires ERC20 tokens. Please wrap your ${nativeSymbol} to W${nativeSymbol} first, ` +
        `or select W${nativeSymbol} as the sell asset.`
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
  if (triggerPriceNum >= currentSellPrice) {
    throw new Error(
      `Trigger price ($${input.triggerPrice}) must be below current price ($${currentSellPrice.toFixed(2)}). ` +
        `A stop-loss triggers when price drops to your threshold.`
    )
  }

  // Calculate buy amount: how much buyAsset we get at the trigger price
  // limitPriceRatio = triggerPrice / buyAssetPrice (how many buyTokens per 1 sellToken at trigger)
  const limitPriceRatio = new BigNumber(input.triggerPrice).div(currentBuyPrice)
  const buyAmountHuman = new BigNumber(input.sellAmount).times(limitPriceRatio).times(SLIPPAGE_BUFFER)
  const buyAmountBaseUnit = toBaseUnit(
    buyAmountHuman.toFixed(buyAsset.precision, BigNumber.ROUND_DOWN),
    buyAsset.precision
  )

  // Get token addresses
  const sellTokenAddress = fromAssetId(sellAsset.assetId).assetReference
  const isNativeBuyToken = isNativeToken(buyAsset)
  const COW_NATIVE_ASSET_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
  const buyTokenAddress = isNativeBuyToken ? COW_NATIVE_ASSET_MARKER : fromAssetId(buyAsset.assetId).assetReference

  const sellAmountBaseUnit = toBaseUnit(input.sellAmount, sellAsset.precision)

  // Check allowance
  const approvalTarget = COW_VAULT_RELAYER_ADDRESS
  const { isApprovalRequired: needsApproval } = await getAllowance({
    amount: sellAmountBaseUnit,
    asset: sellAsset,
    from: userAddress,
    spender: approvalTarget,
  })

  const approvalTx = buildApprovalTransaction(needsApproval, sellAsset, approvalTarget, sellAmountBaseUnit, userAddress)

  // Prepare the CoW order for signing
  const orderResult = prepareCowLimitOrder({
    sellToken: sellTokenAddress,
    buyToken: buyTokenAddress,
    sellAmount: sellAmountBaseUnit,
    buyAmount: buyAmountBaseUnit,
    userAddress,
    chainId: evmChainId,
    expirationSeconds,
    receiver: userAddress,
  })

  // Get CoinGecko ID for price monitoring
  const sellTokenCoingeckoId = assetIdToCoingecko(sellAsset.assetId)
  if (!sellTokenCoingeckoId) {
    throw new Error(`No CoinGecko price feed available for ${sellAsset.symbol}. Stop-loss requires price monitoring.`)
  }

  const priceDistancePercent = new BigNumber(currentSellPrice - triggerPriceNum)
    .div(currentSellPrice)
    .times(100)
    .toFixed(1)

  const estimatedBuyAmount = new BigNumber(input.sellAmount).times(limitPriceRatio).toFixed(6)

  const orderId = `sl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const summary: StopLossSummary = {
    sellAsset: { symbol: sellAsset.symbol, amount: input.sellAmount },
    buyAsset: { symbol: buyAsset.symbol, estimatedAmount: estimatedBuyAmount },
    network: input.network,
    triggerPrice: input.triggerPrice,
    currentPrice: currentSellPrice.toFixed(2),
    priceDistancePercent,
    expiresAt: orderResult.expiresAt,
    provider: 'cow',
  }

  const stopLossRegistration: StopLossRegistration = {
    id: orderId,
    chainId: evmChainId,
    sellToken: sellTokenAddress,
    buyToken: buyTokenAddress,
    sellAmount: sellAmountBaseUnit,
    buyAmount: buyAmountBaseUnit,
    validTo: orderResult.orderToSign.validTo,
    triggerPrice: input.triggerPrice,
    currentPriceAtCreation: currentSellPrice.toFixed(2),
    sellTokenCoingeckoId,
    sellTokenSymbol: sellAsset.symbol,
    buyTokenSymbol: buyAsset.symbol,
    sellAmountHuman: input.sellAmount,
    network: input.network,
    appData: orderResult.orderToSign.appData,
    receiver: userAddress,
    expiresAt: orderResult.expiresAt,
  }

  return {
    summary,
    signingData: orderResult.signingData,
    orderParams: {
      sellToken: sellTokenAddress,
      buyToken: buyTokenAddress,
      sellAmount: sellAmountBaseUnit,
      buyAmount: buyAmountBaseUnit,
      validTo: orderResult.orderToSign.validTo,
      receiver: userAddress,
      chainId: evmChainId,
    },
    needsApproval,
    approvalTx,
    approvalTarget,
    stopLossRegistration,
  }
}

export const createStopLossTool = {
  description: `Create a stop-loss order to automatically sell a token when its price drops to a threshold. The order is held server-side and only submitted to CoW Protocol when the price actually triggers.

UI CARD DISPLAYS: order details (sell/buy assets, amounts), trigger price vs current price with % distance, expiration time, and multi-step signing flow.

Your role is to supplement the card, not duplicate it.

Default: Respond with one brief sentence like:
- "I've prepared your stop-loss order"
- "Your stop-loss is ready to sign and register"
- "Here's your stop-loss for approval"

Only elaborate if the user asks about something not shown in the card.

IMPORTANT:
- Stop-loss requires EIP-712 signature + registration with price monitor
- Trigger price must be BELOW current market price
- Both assets must be on the same EVM network (Ethereum, Gnosis, Arbitrum)
- Order is monitored server-side and submitted to CoW when price drops
- 2% slippage buffer applied to buy amount
- Native tokens (ETH) must be wrapped (WETH) to sell
- Use the maths tool if you need to calculate trigger prices from percentages`,
  inputSchema: createStopLossSchema,
  execute: executeCreateStopLoss,
}
