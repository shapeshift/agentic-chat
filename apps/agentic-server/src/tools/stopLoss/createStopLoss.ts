import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { getSimplePrices } from '../../lib/asset/coingecko'
import {
  buildCreateConditionalOrderTx,
  computeConditionalOrderHash,
  COW_VAULT_RELAYER_ADDRESS,
  encodeStopLossStaticData,
  generateOrderSalt,
  getChainlinkOracle,
  STOP_LOSS_HANDLER_ADDRESS,
} from '../../lib/composableCow'
import type { ConditionalOrderParams } from '../../lib/composableCow'
import { isConditionalOrderActive } from '../../lib/composableCow/events'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getAllowance } from '../../utils'
import { isNativeToken, resolveAsset } from '../../utils/assetHelpers'
import { getBalance } from '../../utils/balanceHelpers'
import { createTransaction } from '../../utils/transactionHelpers'
import { getAddressForChain, getVerifiedSafeAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

const toBigInt = (value: string): bigint => BigInt(new BigNumber(value).toFixed(0))

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
  safeAddress: string
): TransactionData | undefined {
  if (!needsApproval) return undefined

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [getAddress(approvalTarget), toBigInt(sellAmountBaseUnit)],
  })

  const tokenAddress = fromAssetId(sellAsset.assetId).assetReference

  return createTransaction({
    chainId: sellAsset.chainId,
    data,
    from: safeAddress,
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
  sellAmount: z
    .string()
    .describe(
      'Amount to sell as a plain number (e.g., "1" for 1 WETH, "100000" for 100000 PEPE). No commas, dollar signs, or token symbols.'
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
const DEFAULT_APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
const MAX_ORACLE_STALENESS = BigInt(24 * 60 * 60) // 24 hours — must exceed Chainlink's longest heartbeat (USDC/USD = 24h)

export async function executeCreateStopLoss(
  input: CreateStopLossInput,
  walletContext?: WalletContext
): Promise<CreateStopLossOutput> {
  console.log('[createStopLoss] raw input:', JSON.stringify(input))
  const evmChainId = NETWORK_TO_CHAIN_ID[input.network]!

  // Validate Safe address is available on the target chain
  const safeAddress = await getVerifiedSafeAddressForChain(walletContext, evmChainId)
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

  // Native token validation
  if (isNativeToken(sellAsset)) {
    const nativeSymbol = sellAsset.symbol
    throw new Error(
      `Native ${nativeSymbol} cannot be used as sell asset for stop-loss orders. ` +
        `CoW Protocol requires ERC20 tokens. Please wrap your ${nativeSymbol} to W${nativeSymbol} first, ` +
        `or select W${nativeSymbol} as the sell asset.`
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
      `Trigger price ($${input.triggerPrice}) must be below current price ($${currentSellPrice.toFixed(2)}). ` +
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
  const sellTokenAddress = fromAssetId(sellAsset.assetId).assetReference as `0x${string}`
  const isNativeBuyToken = isNativeToken(buyAsset)
  const COW_NATIVE_ASSET_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`
  const buyTokenAddress = isNativeBuyToken
    ? COW_NATIVE_ASSET_MARKER
    : (fromAssetId(buyAsset.assetId).assetReference as `0x${string}`)

  const sellAmountBaseUnit = toBaseUnit(input.sellAmount, sellAsset.precision)
  const buyAmountStr = buyAmountBaseUnit
  const strikePriceStr = new BigNumber(input.triggerPrice)
    .div(currentBuyPrice)
    .times(new BigNumber(10).pow(sellOracle.decimals))
    .integerValue(BigNumber.ROUND_DOWN)
    .toString()

  console.log('[createStopLoss] BigInt candidates:', {
    sellAmountBaseUnit,
    buyAmountBaseUnit: buyAmountStr,
    strikePrice: strikePriceStr,
    sellOracleDecimals: sellOracle.decimals,
  })

  const strikePrice = new BigNumber(strikePriceStr)

  // Calculate cumulative committed amount from existing active orders for same sell token
  let committedAmount = 0n
  const existingOrders = (walletContext?.registryOrders ?? []).filter(
    o =>
      o.orderType === 'stopLoss' &&
      o.chainId === evmChainId &&
      o.sellTokenAddress.toLowerCase() === sellTokenAddress.toLowerCase()
  )
  if (existingOrders.length > 0) {
    const activeResults = await Promise.all(
      existingOrders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, evmChainId))
    )
    console.log(
      '[createStopLoss] existing order amounts:',
      existingOrders.map(o => o.sellAmountBaseUnit)
    )
    committedAmount = existingOrders
      .filter((_, i) => activeResults[i])
      .reduce((sum, o) => sum + toBigInt(o.sellAmountBaseUnit), 0n)
  }

  const totalNeeded = committedAmount + toBigInt(sellAmountBaseUnit)

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
    receiver: safeAddress as `0x${string}`,
    isSellOrder: true,
    isPartiallyFillable: true,
    validTo,
    sellTokenPriceOracle: sellOracle.address as `0x${string}`,
    buyTokenPriceOracle: buyOracle.address as `0x${string}`,
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

  // Check if Safe has sufficient balance for this order plus existing commitments
  const eoaAddress = getAddressForChain(walletContext, sellAsset.chainId)
  const safeBalance = await getBalance(safeAddress, sellAsset)
  console.log('[createStopLoss] safeBalance:', JSON.stringify(safeBalance))
  const needsDeposit = toBigInt(safeBalance) < totalNeeded
  const depositAmount = needsDeposit ? totalNeeded - toBigInt(safeBalance) : 0n

  let depositTx: TransactionData | undefined
  if (needsDeposit) {
    const tokenAddress = fromAssetId(sellAsset.assetId).assetReference
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [getAddress(safeAddress), depositAmount],
    })

    depositTx = createTransaction({
      chainId: sellAsset.chainId,
      data: transferData,
      from: getAddress(eoaAddress),
      to: getAddress(tokenAddress),
      value: '0',
      gasLimit: '65000',
    })
  }

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
    currentPrice: currentSellPrice.toFixed(2),
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
    sellTokenAddress: sellTokenAddress as string,
    buyTokenAddress: buyTokenAddress as string,
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
- Native tokens (ETH) must be wrapped (WETH) to sell
- Use the maths tool if you need to calculate trigger prices from percentages`,
  inputSchema: createStopLossSchema,
  execute: executeCreateStopLoss,
}
