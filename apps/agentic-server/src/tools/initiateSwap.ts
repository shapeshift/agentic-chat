import { fromAssetId } from '@shapeshiftoss/caip'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import type { Asset, GetRateOutput } from '@shapeshiftoss/types'
import { AssetService, toBigInt, toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { getAssetPrices } from '../lib/asset/prices'
import { assetInputSchema } from '../lib/schemas/swapSchemas'
import type { AssetInput, swapPreparationSchema } from '../lib/schemas/swapSchemas'
import { getAllowance } from '../utils'
import { validateAddress } from '../utils/addressValidation'
import { resolveAsset } from '../utils/assetHelpers'
import { validateSufficientBalance } from '../utils/balanceHelpers'
import { isEvmChain } from '../utils/chains/helpers'
import { getBebopRate } from '../utils/getBebopRate'
import { getRelayRate } from '../utils/getRelayRate'
import { networkToFeeSymbol } from '../utils/networkHelpers'
import { createTransaction } from '../utils/transactionHelpers'
import { getAddressForChain } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

interface ResolvedAssets {
  sellAsset: Asset
  buyAsset: Asset
}

async function resolveSwapAssets(
  sellAssetInput: AssetInput,
  buyAssetInput: AssetInput,
  walletContext?: WalletContext
): Promise<ResolvedAssets> {
  // If only one network is specified, default to same-chain swap
  const sellInputWithNetwork = {
    ...sellAssetInput,
    network: sellAssetInput.network || buyAssetInput.network,
  }
  const buyInputWithNetwork = {
    ...buyAssetInput,
    network: buyAssetInput.network || sellAssetInput.network,
  }

  const [sellAsset, buyAsset] = await Promise.all([
    resolveAsset(sellInputWithNetwork, walletContext),
    resolveAsset(buyInputWithNetwork, walletContext),
  ])

  return { sellAsset, buyAsset }
}

type SwapRate = GetRateOutput
type RateResult = { rate: SwapRate } | { error: string }

async function fetchBestSwapRate(
  sellAddress: string,
  buyAddress: string,
  sellAsset: Asset,
  buyAsset: Asset,
  sellAmount: string
): Promise<SwapRate> {
  const isCrossChain = sellAsset.chainId !== buyAsset.chainId
  const ratePromises: Array<Promise<RateResult>> = []

  ratePromises.push(
    getRelayRate({
      address: sellAddress,
      recipientAddress: buyAddress,
      sellAsset,
      buyAsset,
      sellAmountCryptoPrecision: sellAmount,
    })
      .then(rate => ({ rate }))
      .catch((err: Error) => ({ error: err.message }))
  )

  if (!isCrossChain && isEvmChain(sellAsset.chainId)) {
    ratePromises.push(
      getBebopRate({
        address: sellAddress,
        sellAsset,
        buyAsset,
        sellAmountCryptoPrecision: sellAmount,
      })
        .then(rate => ({ rate }))
        .catch((err: Error) => ({ error: err.message }))
    )
  }

  const results = await Promise.all(ratePromises)
  const availableRates = results
    .filter((r): r is { rate: SwapRate } => 'rate' in r)
    .map(r => r.rate)
    .filter(rate => Number.isFinite(rate.expiresAt) && rate.expiresAt > Date.now() + 10_000)
  const errors = results.filter((r): r is { error: string } => 'error' in r).map(r => r.error)

  if (availableRates.length === 0) {
    const errorDetails = errors.length > 0 ? errors.join('. ') : 'Providers returned expired quotes. Please try again.'
    throw new Error(`Failed to fetch swap quotes. ${errorDetails}`)
  }

  return availableRates.reduce((best, current) =>
    parseFloat(current.buyAmountCryptoPrecision) > parseFloat(best.buyAmountCryptoPrecision) ? current : best
  )
}

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
  sellAmount: string,
  userAddress: string
): TransactionData | undefined {
  if (!needsApproval) {
    return undefined
  }

  if (!isEvmChain(sellAsset.chainId)) {
    return undefined
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [getAddress(approvalTarget), toBigInt(toBaseUnit(sellAmount, sellAsset.precision))],
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

function buildSwapTransaction(bestRate: SwapRate) {
  const originalSwapTx = bestRate.unsignedTx

  return createTransaction({
    chainId: originalSwapTx.chainId,
    data: originalSwapTx.data || '',
    from: originalSwapTx.from,
    to: originalSwapTx.to,
    value: originalSwapTx.value || '0',
    ...(originalSwapTx.gasLimit && {
      gasLimit: String(originalSwapTx.gasLimit),
    }),
  })
}

function createSwapSummary(sellAsset: Asset, buyAsset: Asset, sellAmount: string, bestRate: SwapRate) {
  const sellPrice = parseFloat(sellAsset.price || '0')
  const buyPrice = parseFloat(buyAsset.price || '0')

  const sellValueUSD = sellPrice > 0 ? (parseFloat(sellAmount) * sellPrice).toFixed(2) : null
  const buyEstimatedValueUSD =
    buyPrice > 0 ? (parseFloat(bestRate.buyAmountCryptoPrecision) * buyPrice).toFixed(2) : null
  const exchangeRate = (parseFloat(bestRate.buyAmountCryptoPrecision) / parseFloat(sellAmount)).toFixed(8)

  const priceImpact =
    sellValueUSD && buyEstimatedValueUSD
      ? (((parseFloat(buyEstimatedValueUSD) - parseFloat(sellValueUSD)) / parseFloat(sellValueUSD)) * 100).toFixed(2)
      : null

  const feeSymbol = networkToFeeSymbol[sellAsset.network] || sellAsset.symbol.toUpperCase()

  return {
    sellAsset: {
      symbol: sellAsset.symbol.toUpperCase(),
      amount: sellAmount,
      network: sellAsset.network,
      chainName: sellAsset.name || 'Unknown Chain',
      valueUSD: sellValueUSD || null,
      priceUSD: sellPrice > 0 ? sellPrice.toFixed(4) : null,
    },
    buyAsset: {
      symbol: buyAsset.symbol.toUpperCase(),
      estimatedAmount: bestRate.buyAmountCryptoPrecision,
      network: buyAsset.network,
      chainName: buyAsset.name || 'Unknown Chain',
      estimatedValueUSD: buyEstimatedValueUSD || null,
      priceUSD: buyPrice > 0 ? buyPrice.toFixed(2) : null,
    },
    exchange: {
      provider: bestRate.source || 'Unknown',
      rate: `1 ${sellAsset.symbol.toUpperCase()} = ${exchangeRate} ${buyAsset.symbol.toUpperCase()}`,
      priceImpact: priceImpact || null,
      networkFeeCrypto: bestRate.networkFeeCryptoPrecision,
      networkFeeSymbol: feeSymbol,
      networkFeeUsd: bestRate.networkFeeUsd,
    },
    isCrossChain: sellAsset.network !== buyAsset.network,
  }
}

async function executeSwapInternal({
  sellAssetInput,
  buyAssetInput,
  sellAmountCrypto,
  walletContext,
}: {
  sellAssetInput: AssetInput
  buyAssetInput: AssetInput
  sellAmountCrypto: string
  walletContext?: WalletContext
}): Promise<z.infer<typeof swapPreparationSchema>> {
  if (!Number.isFinite(parseFloat(sellAmountCrypto)) || parseFloat(sellAmountCrypto) <= 0) {
    throw new Error('Sell amount must be a positive number')
  }

  const { sellAsset, buyAsset } = await resolveSwapAssets(sellAssetInput, buyAssetInput, walletContext)

  const sellAddress = getAddressForChain(walletContext, sellAsset.chainId)
  const buyAddress = getAddressForChain(walletContext, buyAsset.chainId)

  validateAddress(sellAddress, sellAsset.chainId)
  validateAddress(buyAddress, buyAsset.chainId)

  return prepareSwap(sellAsset, buyAsset, sellAmountCrypto, sellAddress, buyAddress)
}

async function prepareSwap(
  sellAsset: Asset,
  buyAsset: Asset,
  sellAmountCrypto: string,
  sellAddress: string,
  buyAddress: string
): Promise<z.infer<typeof swapPreparationSchema>> {
  const bestRate = await fetchBestSwapRate(sellAddress, buyAddress, sellAsset, buyAsset, sellAmountCrypto)

  const allowanceData = await getAllowance({
    amount: toBaseUnit(sellAmountCrypto, sellAsset.precision),
    asset: sellAsset,
    from: sellAddress,
    spender: bestRate.approvalTarget,
  })

  const needsApproval = allowanceData.isApprovalRequired

  await validateSufficientBalance(sellAddress, sellAsset, sellAmountCrypto)

  const approvalTx = buildApprovalTransaction(
    needsApproval,
    sellAsset,
    bestRate.approvalTarget,
    sellAmountCrypto,
    sellAddress
  )

  const swapTx = buildSwapTransaction(bestRate)

  const summary = createSwapSummary(sellAsset, buyAsset, sellAmountCrypto, bestRate)

  const sellPrice = parseFloat(sellAsset.price || '0')
  const buyPrice = parseFloat(buyAsset.price || '0')
  const sellValueUSD = sellPrice > 0 ? (parseFloat(sellAmountCrypto) * sellPrice).toFixed(2) : undefined
  const buyEstimatedValueUSD =
    buyPrice > 0 ? (parseFloat(bestRate.buyAmountCryptoPrecision) * buyPrice).toFixed(2) : undefined

  const swapExecutionData = {
    sellAmountCryptoPrecision: sellAmountCrypto,
    buyAmountCryptoPrecision: bestRate.buyAmountCryptoPrecision,
    sellAmountUsd: sellValueUSD,
    buyAmountUsd: buyEstimatedValueUSD,
    approvalTarget: bestRate.approvalTarget,
    sellAsset,
    buyAsset,
    sellAccount: sellAddress,
    buyAccount: buyAddress,
  }

  if (!Number.isFinite(bestRate.expiresAt) || bestRate.expiresAt <= Date.now() + 10_000) {
    throw new Error('Swap quote expired during preparation. Please request a new quote.')
  }

  return {
    expiresAt: bestRate.expiresAt,
    summary,
    needsApproval,
    approvalTx,
    swapTx,
    swapData: swapExecutionData,
  }
}

export const initiateSwapSchema = z.object({
  sellAsset: assetInputSchema.describe('Asset to sell'),
  buyAsset: assetInputSchema.describe('Asset to buy'),
  sellAmount: z.string().describe('Amount to sell in crypto tokens, e.g. 1 for 1 ETH, 0.5 for 0.5 SOL'),
})

export type InitiateSwapInput = z.infer<typeof initiateSwapSchema>
export type InitiateSwapOutput = z.infer<typeof swapPreparationSchema>

export async function executeInitiateSwap(
  input: InitiateSwapInput,
  walletContext?: WalletContext
): Promise<InitiateSwapOutput> {
  return executeSwapInternal({
    sellAssetInput: input.sellAsset,
    buyAssetInput: input.buyAsset,
    sellAmountCrypto: input.sellAmount,
    walletContext,
  })
}

export const initiateSwapTool = {
  description: `Execute a swap between tokens (crypto amounts). EVM and Solana only.

UI CARD DISPLAYS: sell/buy amounts, tokens, exchange rate, network fees, and price impact.`,
  inputSchema: initiateSwapSchema,
  execute: executeInitiateSwap,
}

export const initiateSwapUsdSchema = z.object({
  sellAsset: assetInputSchema.describe('Asset to sell'),
  buyAsset: assetInputSchema.describe('Asset to buy'),
  sellAmountUsd: z.string().describe('USD value to swap, e.g. "100" for $100 worth, "1.50" for $1.50 worth'),
})

export type InitiateSwapUsdInput = z.infer<typeof initiateSwapUsdSchema>
export type InitiateSwapUsdOutput = z.infer<typeof swapPreparationSchema>

export async function executeInitiateSwapUsd(
  input: InitiateSwapUsdInput,
  walletContext?: WalletContext
): Promise<InitiateSwapUsdOutput> {
  const { sellAsset: sellAssetInput, buyAsset: buyAssetInput, sellAmountUsd } = input

  if (!Number.isFinite(parseFloat(sellAmountUsd)) || parseFloat(sellAmountUsd) <= 0) {
    throw new Error('USD amount must be a positive number')
  }

  const sellAsset = await resolveAsset(sellAssetInput, walletContext)
  const sellAssetPrice = parseFloat(sellAsset.price || '0')

  if (sellAssetPrice <= 0) {
    throw new Error(`Unable to fetch price for ${sellAsset.symbol}. Price data may be unavailable.`)
  }

  const sellAmountCrypto = (parseFloat(sellAmountUsd) / sellAssetPrice).toString()

  return executeSwapInternal({
    sellAssetInput,
    buyAssetInput,
    sellAmountCrypto,
    walletContext,
  })
}

export const initiateSwapUsdTool = {
  description: `Execute a swap between tokens (USD amounts). EVM and Solana only.

UI CARD DISPLAYS: sell/buy amounts, tokens, exchange rate, network fees, and price impact.`,
  inputSchema: initiateSwapUsdSchema,
  execute: executeInitiateSwapUsd,
}

// Refresh exact assets and amounts without repeating symbol resolution or USD conversion.
export const refreshSwapSchema = z.object({
  sellAssetId: z.string().min(1),
  buyAssetId: z.string().min(1),
  sellAmount: z
    .string()
    .regex(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i)
    .refine(value => Number.isFinite(Number(value)) && Number(value) > 0),
  sellAccount: z.string().min(1),
  buyAccount: z.string().min(1),
})

export async function refreshSwap(input: z.infer<typeof refreshSwapSchema>): Promise<InitiateSwapOutput> {
  const resolveExact = (assetId: string): Asset => {
    const asset = AssetService.getInstance().getAsset(assetId)
    if (!asset) throw new Error('Swap asset is no longer available. Please request a new swap.')
    const network = chainIdToNetwork[asset.chainId]
    if (!network) throw new Error('Unsupported swap network')
    return { ...asset, network, price: '0' }
  }
  const sellAsset = resolveExact(input.sellAssetId)
  const buyAsset = resolveExact(input.buyAssetId)
  const prices = await getAssetPrices([sellAsset.assetId, buyAsset.assetId])
  sellAsset.price = prices[0]?.price ?? '0'
  buyAsset.price = prices[1]?.price ?? '0'
  validateAddress(input.sellAccount, sellAsset.chainId)
  validateAddress(input.buyAccount, buyAsset.chainId)
  if (
    sellAsset.chainId === buyAsset.chainId &&
    (isEvmChain(sellAsset.chainId)
      ? input.sellAccount.toLowerCase() !== input.buyAccount.toLowerCase()
      : input.sellAccount !== input.buyAccount)
  ) {
    throw new Error('Same-chain swaps must use the same sending and receiving account')
  }
  return prepareSwap(sellAsset, buyAsset, input.sellAmount, input.sellAccount, input.buyAccount)
}
