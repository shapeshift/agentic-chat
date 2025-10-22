import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, GetRateOutput } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import { fromBaseUnit, toBaseUnit } from '@shapeshiftoss/utils'
import { PublicKey } from '@solana/web3.js'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import { z } from 'zod'

import { assetInputSchema } from '../lib/schemas/swapSchemas'
import type { AssetInput, swapPreparationSchema } from '../lib/schemas/swapSchemas'
import { getAllowance } from '../utils'
import { isEvmChain, isSolanaChain } from '../utils/chains/helpers'
import { getBebopRate } from '../utils/getBebopRate'
import { getRelayRate } from '../utils/getRelayRate'
import { getAddressForChain } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

import { executeGetAccount } from './getAccount'
import { executeGetAssets } from './getAssets'

interface ResolvedAssets {
  sellAsset: Asset
  buyAsset: Asset
}

function createTransaction(tx: {
  chainId: string | number
  data: string
  from: string
  to: string
  value: string
  gasLimit?: string
}) {
  return {
    chainId: String(tx.chainId),
    data: tx.data || '',
    from: tx.from,
    to: tx.to,
    value: tx.value,
    ...(tx.gasLimit && { gasLimit: tx.gasLimit }),
  }
}

async function resolveSwapAssets(sellAssetInput: AssetInput, buyAssetInput: AssetInput): Promise<ResolvedAssets> {
  const [buyAssetsResult, sellAssetsResult] = await Promise.all([
    executeGetAssets({ searchTerm: buyAssetInput.symbolOrName, network: buyAssetInput.network }),
    executeGetAssets({ searchTerm: sellAssetInput.symbolOrName, network: sellAssetInput.network }),
  ])

  if (sellAssetsResult.assets.length === 0) {
    throw new Error(
      `No asset found for "${sellAssetInput.symbolOrName}"${sellAssetInput.network ? ` on ${sellAssetInput.network}` : ''}`
    )
  }
  if (sellAssetsResult.assets.length > 1) {
    throw new Error(`Multiple assets found for "${sellAssetInput.symbolOrName}". Please be more specific.`)
  }
  if (buyAssetsResult.assets.length === 0) {
    throw new Error(
      `No asset found for "${buyAssetInput.symbolOrName}"${buyAssetInput.network ? ` on ${buyAssetInput.network}` : ''}`
    )
  }
  if (buyAssetsResult.assets.length > 1) {
    throw new Error(`Multiple assets found for "${buyAssetInput.symbolOrName}". Please be more specific.`)
  }

  const sellAsset = sellAssetsResult.assets[0]
  const buyAsset = buyAssetsResult.assets[0]

  return { sellAsset, buyAsset }
}

type SwapRate = GetRateOutput

async function fetchBestSwapRate(
  sellAddress: string,
  buyAddress: string,
  sellAsset: Asset,
  buyAsset: Asset,
  sellAmount: string
): Promise<SwapRate> {
  const isCrossChain = sellAsset.chainId !== buyAsset.chainId
  const ratePromises: Array<Promise<SwapRate | null>> = []

  ratePromises.push(
    getRelayRate({
      address: sellAddress,
      recipientAddress: buyAddress,
      sellAsset,
      buyAsset,
      sellAmountCryptoPrecision: sellAmount,
    }).catch(() => null)
  )

  if (!isCrossChain && isEvmChain(sellAsset.chainId)) {
    ratePromises.push(
      getBebopRate({
        address: sellAddress,
        sellAsset,
        buyAsset,
        sellAmountCryptoPrecision: sellAmount,
      }).catch(() => null)
    )
  }

  const rates = await Promise.all(ratePromises)
  const availableRates = rates.filter((rate): rate is SwapRate => rate !== null)

  if (availableRates.length === 0) {
    throw new Error(
      'No rates available from any provider. This swap route may not be supported or the amount may be too small.'
    )
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
    args: [getAddress(approvalTarget), BigInt(toBaseUnit(sellAmount, sellAsset.precision))],
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
    ...(originalSwapTx.gasLimit && { gasLimit: String(originalSwapTx.gasLimit) }),
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

  return {
    sellAsset: {
      symbol: sellAsset.symbol.toUpperCase(),
      amount: sellAmount,
      network: sellAsset.network,
      chainName: sellAsset.name || 'Unknown Chain',
      valueUSD: sellValueUSD ? `$${sellValueUSD}` : 'N/A',
      priceUSD: sellPrice > 0 ? `$${sellPrice.toFixed(4)}` : 'N/A',
    },
    buyAsset: {
      symbol: buyAsset.symbol.toUpperCase(),
      estimatedAmount: parseFloat(bestRate.buyAmountCryptoPrecision).toFixed(8),
      network: buyAsset.network,
      chainName: buyAsset.name || 'Unknown Chain',
      estimatedValueUSD: buyEstimatedValueUSD ? `$${buyEstimatedValueUSD}` : 'N/A',
      priceUSD: buyPrice > 0 ? `$${buyPrice.toFixed(2)}` : 'N/A',
    },
    exchange: {
      provider: bestRate.source || 'Unknown',
      rate: `1 ${sellAsset.symbol.toUpperCase()} = ${exchangeRate} ${buyAsset.symbol.toUpperCase()}`,
      priceImpact: priceImpact ? `${priceImpact}%` : 'N/A',
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

  const { sellAsset, buyAsset } = await resolveSwapAssets(sellAssetInput, buyAssetInput)

  const sellAddress = getAddressForChain(walletContext, sellAsset.chainId)
  const buyAddress = getAddressForChain(walletContext, buyAsset.chainId)

  if (isSolanaChain(sellAsset.chainId)) {
    try {
      new PublicKey(sellAddress)
    } catch {
      throw new Error(`Invalid Solana address for sell asset: ${sellAddress}`)
    }
  }

  if (isSolanaChain(buyAsset.chainId)) {
    try {
      new PublicKey(buyAddress)
    } catch {
      throw new Error(`Invalid Solana address for buy asset: ${buyAddress}`)
    }
  }

  const bestRate = await fetchBestSwapRate(sellAddress, buyAddress, sellAsset, buyAsset, sellAmountCrypto)

  const allowanceData = await getAllowance({
    amount: toBaseUnit(sellAmountCrypto, sellAsset.precision),
    asset: sellAsset,
    from: sellAddress,
    spender: bestRate.approvalTarget,
  })

  const needsApproval = allowanceData.isApprovalRequired

  const accountData = await executeGetAccount({
    account: sellAddress,
    network: chainIdToNetwork[sellAsset.chainId],
  })

  const userBalance = accountData.balances[sellAsset.assetId] || '0'
  const sellAmountBaseUnit = toBaseUnit(sellAmountCrypto, sellAsset.precision)

  if (BigInt(userBalance) < BigInt(sellAmountBaseUnit)) {
    const availableAmount = fromBaseUnit(userBalance, sellAsset.precision)
    throw new Error(
      `Insufficient ${sellAsset.symbol} balance. Required: ${sellAmountCrypto}, Available: ${availableAmount}`
    )
  }

  const approvalTx = buildApprovalTransaction(
    needsApproval,
    sellAsset,
    bestRate.approvalTarget,
    sellAmountCrypto,
    sellAddress
  )

  const swapTx = buildSwapTransaction(bestRate)

  const summary = createSwapSummary(sellAsset, buyAsset, sellAmountCrypto, bestRate)

  const swapExecutionData = {
    sellAmountCryptoPrecision: sellAmountCrypto,
    buyAmountCryptoPrecision: bestRate.buyAmountCryptoPrecision,
    approvalTarget: bestRate.approvalTarget,
    sellAsset,
    buyAsset,
    sellAccount: sellAddress,
    buyAccount: buyAddress,
  }

  return {
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
  description:
    'Start a crypto swap using CRYPTO TOKEN amounts. ONLY supports EVM chains (Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BSC, Gnosis) and Solana. NOT supported for Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, Cardano, or Sui. Use initiateSwapUsd for USD-denominated amounts.',
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

  const sellAssetsResult = await executeGetAssets({
    searchTerm: sellAssetInput.symbolOrName,
    network: sellAssetInput.network,
  })

  if (sellAssetsResult.assets.length === 0) {
    throw new Error(
      `No asset found for "${sellAssetInput.symbolOrName}"${sellAssetInput.network ? ` on ${sellAssetInput.network}` : ''}`
    )
  }
  if (sellAssetsResult.assets.length > 1) {
    throw new Error(`Multiple assets found for "${sellAssetInput.symbolOrName}". Please specify network.`)
  }

  const sellAsset = sellAssetsResult.assets[0]
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
  description:
    'Start a crypto swap using USD VALUE amounts (e.g., $100 worth of ETH). Fetches current price and converts to token amount. ONLY supports EVM chains (Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BSC, Gnosis) and Solana. NOT supported for Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, Cardano, or Sui.',
  inputSchema: initiateSwapUsdSchema,
  execute: executeInitiateSwapUsd,
}
