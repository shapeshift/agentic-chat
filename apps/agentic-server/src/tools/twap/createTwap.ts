import { fromAssetId } from '@shapeshiftoss/caip'
import { toBigInt, toBaseUnit } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

import { getSimplePrices } from '../../lib/asset/coingecko'
import type { TransactionData } from '../../lib/schemas/swapSchemas'
import {
  buildCreateConditionalOrderTx,
  computeConditionalOrderHash,
  COW_VAULT_RELAYER_ADDRESS,
  CURRENT_BLOCK_TIMESTAMP_FACTORY,
  encodeTwapStaticData,
  generateOrderSalt,
  TWAP_HANDLER_ADDRESS,
} from '../../lib/composableCow'
import type { ConditionalOrderParams } from '../../lib/composableCow'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getAllowance } from '../../utils'
import { buildApprovalTransaction } from '../../utils/approvalHelpers'
import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { calculateSafeVaultDeposit } from '../../utils/safeVaultDeposit'
import { getAddressForChain, getVerifiedSafeAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

const DURATION_PATTERNS: Array<{ regex: RegExp; toSeconds: (match: RegExpMatchArray) => number }> = [
  { regex: /^(\d+)\s*min(ute)?s?$/i, toSeconds: m => Number(m[1]) * 60 },
  { regex: /^(\d+)\s*h(ou)?rs?$/i, toSeconds: m => Number(m[1]) * 3600 },
  { regex: /^(\d+)\s*d(ay)?s?$/i, toSeconds: m => Number(m[1]) * 86400 },
  { regex: /^(\d+)\s*w(ee)?ks?$/i, toSeconds: m => Number(m[1]) * 604800 },
  { regex: /^(\d+)\s*months?$/i, toSeconds: m => Number(m[1]) * 2592000 },
]

function parseDuration(duration: string): number {
  for (const { regex, toSeconds } of DURATION_PATTERNS) {
    const match = duration.match(regex)
    if (match) return toSeconds(match)
  }
  throw new Error(
    `Could not parse duration "${duration}". Use formats like "24 hours", "7 days", "2 weeks", or "1 month".`
  )
}

function calculateDefaultIntervals(durationSeconds: number): number {
  if (durationSeconds <= 3600) return Math.max(durationSeconds / 300, 2)
  if (durationSeconds <= 86400) return 24
  if (durationSeconds <= 604800) return 7
  return Math.ceil(durationSeconds / 86400)
}

export const createTwapSchema = z.object({
  sellAsset: z.string().describe('Token symbol or name to sell (e.g., "USDC", "WETH")'),
  buyAsset: z.string().describe('Token symbol or name to buy (e.g., "ETH", "WBTC")'),
  network: z.enum(['ethereum', 'gnosis', 'arbitrum']).describe('Network for the TWAP/DCA order'),
  totalAmount: z
    .string()
    .describe(
      'Total amount to sell in TOKEN units, not USD (e.g., "1000" for 1000 USDC, "0.5" for 0.5 WETH). If the user specified a USD dollar amount, convert to token units first using getAssetPricesTool and mathCalculatorTool.'
    ),
  duration: z.string().describe('Total duration for the order (e.g., "24 hours", "7 days", "2 weeks", "1 month")'),
  intervals: z
    .number()
    .min(2)
    .max(365)
    .optional()
    .describe('Number of trades to split into. Default: calculated from duration.'),
})

export type CreateTwapInput = z.infer<typeof createTwapSchema>

export interface TwapSummary {
  sellAsset: { symbol: string; totalAmount: string; perTradeAmount: string }
  buyAsset: { symbol: string }
  network: string
  duration: string
  durationSeconds: number
  intervals: number
  frequency: string
  provider: 'cow'
}

export interface CreateTwapOutput {
  summary: TwapSummary
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
  durationSeconds: number
}

const TWAP_SLIPPAGE_BUFFER = 0.95 // 5% buffer (wider than stop-loss 2% since TWAP executes over time)
const DEFAULT_APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

function formatFrequency(intervalSeconds: number): string {
  if (intervalSeconds < 3600) return `Every ${Math.round(intervalSeconds / 60)} minutes`
  if (intervalSeconds < 86400) return `Every ${Math.round(intervalSeconds / 3600)} hours`
  if (intervalSeconds === 86400) return 'Daily'
  return `Every ${Math.round(intervalSeconds / 86400)} days`
}

export async function executeCreateTwap(
  input: CreateTwapInput,
  walletContext?: WalletContext
): Promise<CreateTwapOutput> {
  const evmChainId = NETWORK_TO_CHAIN_ID[input.network]!

  const safeAddress = await getVerifiedSafeAddressForChain(walletContext, evmChainId)
  if (!safeAddress) {
    throw new Error(
      'TWAP/DCA orders require a Safe smart account. A Safe will be deployed automatically when you submit this order.'
    )
  }

  const [sellAsset, buyAsset] = await Promise.all([
    resolveAsset({ symbolOrName: input.sellAsset, network: input.network }, walletContext),
    resolveAsset({ symbolOrName: input.buyAsset, network: input.network }, walletContext),
  ])
  getAddressForChain(walletContext, sellAsset.chainId)

  if (isNativeToken(sellAsset)) {
    const nativeSymbol = sellAsset.symbol
    throw new Error(
      `Native ${nativeSymbol} cannot be used as sell asset for TWAP orders. ` +
        `CoW Protocol requires ERC20 tokens. Please wrap your ${nativeSymbol} to W${nativeSymbol} first.`
    )
  }

  const durationSeconds = parseDuration(input.duration)
  const numParts = input.intervals ?? calculateDefaultIntervals(durationSeconds)
  const intervalSeconds = Math.floor(durationSeconds / numParts)

  if (intervalSeconds < 120) {
    throw new Error('Trade interval is too short. Minimum interval is 2 minutes between trades.')
  }

  const sellAmountBaseUnit = toBaseUnit(input.totalAmount, sellAsset.precision)
  const partSellAmount = toBigInt(sellAmountBaseUnit) / BigInt(numParts)

  if (partSellAmount === 0n) {
    throw new Error('Total amount is too small to split into the requested number of intervals.')
  }

  const sellTokenAddress = fromAssetId(sellAsset.assetId).assetReference as `0x${string}`
  const isNativeBuyToken = isNativeToken(buyAsset)
  const COW_NATIVE_ASSET_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`
  const buyTokenAddress = isNativeBuyToken
    ? COW_NATIVE_ASSET_MARKER
    : (fromAssetId(buyAsset.assetId).assetReference as `0x${string}`)

  const approvalTarget = COW_VAULT_RELAYER_ADDRESS

  const { totalNeeded, needsDeposit, depositTx } = await calculateSafeVaultDeposit({
    walletContext,
    safeAddress,
    sellAsset,
    sellAmountBaseUnit,
    evmChainId,
    sellTokenAddress,
  })

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

  const salt = generateOrderSalt(safeAddress, sellTokenAddress, buyTokenAddress)

  const priceResults = await getSimplePrices([sellAsset.assetId, buyAsset.assetId])
  const sellAssetPrice = Number(priceResults.find(p => p.assetId === sellAsset.assetId)?.price ?? '0')
  const buyAssetPrice = Number(priceResults.find(p => p.assetId === buyAsset.assetId)?.price ?? '0')

  let minPartLimit = 0n
  if (sellAssetPrice > 0 && buyAssetPrice > 0) {
    const partSellHuman = new BigNumber(partSellAmount.toString()).div(new BigNumber(10).pow(sellAsset.precision))
    const priceRatio = new BigNumber(sellAssetPrice).div(buyAssetPrice)
    const minPartLimitHuman = partSellHuman.times(priceRatio).times(TWAP_SLIPPAGE_BUFFER)
    minPartLimit = toBigInt(
      toBaseUnit(minPartLimitHuman.toFixed(buyAsset.precision, BigNumber.ROUND_DOWN), buyAsset.precision)
    )
  }

  const staticData = encodeTwapStaticData({
    sellToken: sellTokenAddress,
    buyToken: buyTokenAddress,
    receiver: safeAddress as `0x${string}`,
    partSellAmount,
    minPartLimit,
    t0: 0n,
    n: BigInt(numParts),
    t: BigInt(intervalSeconds),
    span: 0n,
    appData: DEFAULT_APP_DATA,
  })

  const conditionalOrderParams: ConditionalOrderParams = {
    handler: TWAP_HANDLER_ADDRESS,
    salt,
    staticInput: staticData,
  }

  const orderHash = computeConditionalOrderHash(conditionalOrderParams)
  const safeTransaction = buildCreateConditionalOrderTx(conditionalOrderParams, {
    factory: CURRENT_BLOCK_TIMESTAMP_FACTORY,
  })

  const perTradeAmount = new BigNumber(input.totalAmount).div(numParts).toFixed(sellAsset.precision)

  const summary: TwapSummary = {
    sellAsset: { symbol: sellAsset.symbol, totalAmount: input.totalAmount, perTradeAmount },
    buyAsset: { symbol: buyAsset.symbol },
    network: input.network,
    duration: input.duration,
    durationSeconds,
    intervals: numParts,
    frequency: formatFrequency(intervalSeconds),
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
    sellTokenAddress: sellTokenAddress as string,
    buyTokenAddress: buyTokenAddress as string,
    sellAmountBaseUnit,
    sellPrecision: sellAsset.precision,
    buyPrecision: buyAsset.precision,
    durationSeconds,
  }
}

export const createTwapTool = {
  description: `Create a TWAP (Time-Weighted Average Price) or DCA (Dollar Cost Averaging) order to split a large trade into smaller parts executed over time.

UI CARD DISPLAYS: order details (sell/buy assets, total and per-trade amounts), duration, intervals, frequency, Safe address, and multi-step transaction flow.

IMPORTANT:
- TWAP = short duration (hours), DCA = long duration (days/weeks) — same mechanism
- Requires a Safe smart account (deployed automatically on first use)
- No price oracle needed — purely time-based execution at market price
- Supports: Ethereum, Gnosis, Arbitrum (same-chain only)
- Native tokens (ETH) must be wrapped (WETH) to sell`,
  inputSchema: createTwapSchema,
  execute: executeCreateTwap,
}
