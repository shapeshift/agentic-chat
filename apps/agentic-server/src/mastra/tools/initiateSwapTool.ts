import { createTool } from '@mastra/core'
import type { MastraUnion } from '@mastra/core/action'
import type { RuntimeContext } from '@mastra/core/runtime-context'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, GetRateOutput } from '@shapeshiftoss/types'
import { toBaseUnit, fromBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import z from 'zod'

import { getAllowance } from '../../utils'
import { getBebopRate } from '../../utils/getBebopRate'
import { getRelayRate } from '../../utils/getRelayRate'

import { getAssetsTool } from './asset/getAssetsTool'
import { getAccountTool } from './getAccountTool'
import { assetInputSchema, swapPreparationSchema } from './schemas/swapSchemas'
import type { AssetInput } from './schemas/swapSchemas'

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

type GetAssetsTool = typeof getAssetsTool

async function resolveSwapAssets(
  sellAssetInput: AssetInput,
  buyAssetInput: AssetInput,
  getAssetsTool: GetAssetsTool,
  mastra: MastraUnion,
  runtimeContext: RuntimeContext<unknown>
): Promise<ResolvedAssets> {
  const [buyAssetsResult, sellAssetsResult] = await Promise.all([
    getAssetsTool.execute({
      context: { searchTerm: buyAssetInput.symbolOrName, network: buyAssetInput.network },
      mastra,
      runtimeContext,
    }),
    getAssetsTool.execute({
      context: { searchTerm: sellAssetInput.symbolOrName, network: sellAssetInput.network },
      mastra,
      runtimeContext,
    }),
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
  userAddress: string,
  sellAsset: Asset,
  buyAsset: Asset,
  sellAmount: string
): Promise<SwapRate> {
  const isCrossChain = sellAsset.chainId !== buyAsset.chainId

  const ratePromises = [
    getRelayRate({
      address: userAddress,
      sellAsset,
      buyAsset,
      sellAmountCryptoPrecision: sellAmount,
    }).catch(() => null),
  ]

  // Only fetch Bebop rate for same-chain swaps
  if (!isCrossChain) {
    ratePromises.push(
      getBebopRate({
        address: userAddress,
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

  // Find the rate with the highest buy amount
  const bestRate = availableRates.reduce((best, current) =>
    parseFloat(current.buyAmountCryptoPrecision) > parseFloat(best.buyAmountCryptoPrecision) ? current : best
  )

  return bestRate
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
  const swapCalldata = originalSwapTx.data || ''

  // Validate transaction data
  if (swapCalldata && typeof swapCalldata === 'string') {
    // Ensure the data is a valid hex string
    if (!swapCalldata.startsWith('0x')) {
      throw new Error('Invalid transaction data: must start with 0x')
    }
  }

  return createTransaction({
    chainId: originalSwapTx.chainId,
    data: swapCalldata,
    from: originalSwapTx.from,
    to: originalSwapTx.to,
    value: originalSwapTx.value || '0',
    ...(originalSwapTx.gasLimit && { gasLimit: String(originalSwapTx.gasLimit) }),
  })
}

function createSwapSummary(sellAsset: Asset, buyAsset: Asset, sellAmount: string, bestRate: SwapRate) {
  const sellValueUSD = (parseFloat(sellAmount) * parseFloat(sellAsset.price || '0')).toFixed(2)
  const buyEstimatedValueUSD = (
    parseFloat(bestRate.buyAmountCryptoPrecision) * parseFloat(buyAsset.price || '0')
  ).toFixed(2)
  const exchangeRate = (parseFloat(bestRate.buyAmountCryptoPrecision) / parseFloat(sellAmount)).toFixed(8)

  // Calculate price impact (difference in USD values)
  const priceImpact =
    sellValueUSD && buyEstimatedValueUSD
      ? (((parseFloat(buyEstimatedValueUSD) - parseFloat(sellValueUSD)) / parseFloat(sellValueUSD)) * 100).toFixed(2)
      : '0.00'

  return {
    sellAsset: {
      symbol: sellAsset.symbol.toUpperCase(),
      amount: sellAmount,
      network: sellAsset.network,
      chainName: sellAsset.name || 'Unknown Chain',
      valueUSD: `$${sellValueUSD}`,
      priceUSD: `$${parseFloat(sellAsset.price || '0').toFixed(4)}`,
    },
    buyAsset: {
      symbol: buyAsset.symbol.toUpperCase(),
      estimatedAmount: parseFloat(bestRate.buyAmountCryptoPrecision).toFixed(8),
      network: buyAsset.network,
      chainName: buyAsset.name || 'Unknown Chain',
      estimatedValueUSD: `$${buyEstimatedValueUSD}`,
      priceUSD: `$${parseFloat(buyAsset.price || '0').toFixed(2)}`,
    },
    exchange: {
      provider: bestRate.source || 'Unknown',
      rate: `1 ${sellAsset.symbol.toUpperCase()} = ${exchangeRate} ${buyAsset.symbol.toUpperCase()}`,
      priceImpact: `${priceImpact}%`,
    },
    isCrossChain: sellAsset.network !== buyAsset.network,
  }
}

export const initiateSwapInput = z.object({
  sellAsset: assetInputSchema.describe('Asset to sell'),
  buyAsset: assetInputSchema.describe('Asset to buy'),
  sellAmount: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
  userAddress: z.string().describe('User wallet address for the swap'),
})

export const initiateSwapOutput = swapPreparationSchema

export type InitiateSwapInput = z.infer<typeof initiateSwapInput>
export type InitiateSwapOutput = z.infer<typeof initiateSwapOutput>

export const initiateSwapTool = createTool({
  id: 'initiateSwap',
  description: 'Start a crypto swap transaction that requires user wallet approval',
  inputSchema: initiateSwapInput,
  outputSchema: initiateSwapOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger()
    if (!mastra) {
      throw Error('no mastra instance')
    }
    logger?.info('🚀 [prepareSwapTool] STARTING execution:', { context })

    const { sellAsset: sellAssetInput, buyAsset: buyAssetInput, sellAmount, userAddress } = context

    if (!Number.isFinite(parseFloat(sellAmount)) || parseFloat(sellAmount) <= 0) {
      throw new Error('Sell amount must be a positive number')
    }

    const { sellAsset, buyAsset } = await resolveSwapAssets(
      sellAssetInput,
      buyAssetInput,
      getAssetsTool,
      mastra,
      runtimeContext
    )

    logger?.info('📋 Resolved assets:', {
      sellAsset: {
        assetId: sellAsset.assetId,
        symbol: sellAsset.symbol,
        network: sellAsset.network,
        chainId: sellAsset.chainId,
      },
      buyAsset: {
        assetId: buyAsset.assetId,
        symbol: buyAsset.symbol,
        network: buyAsset.network,
        chainId: buyAsset.chainId,
      },
    })

    const bestRate = await fetchBestSwapRate(userAddress, sellAsset, buyAsset, sellAmount)

    const allowanceData = await getAllowance({
      amount: toBaseUnit(sellAmount, sellAsset.precision),
      asset: sellAsset,
      from: userAddress,
      spender: bestRate.approvalTarget,
    })

    const needsApproval = allowanceData.isApprovalRequired

    logger?.info('🔍 Allowance check:', {
      needsApproval,
      sellAssetId: sellAsset.assetId,
      sellAssetSymbol: sellAsset.symbol,
      approvalTarget: bestRate.approvalTarget,
      sellAmount,
      sellAmountBaseUnit: toBaseUnit(sellAmount, sellAsset.precision),
    })

    // Balance validation
    const accountData = await getAccountTool.execute({
      context: { account: userAddress, chainId: sellAsset.chainId },
      mastra,
      runtimeContext,
    })

    const userBalance = accountData.balances[sellAsset.assetId] || '0'
    const sellAmountBaseUnit = toBaseUnit(sellAmount, sellAsset.precision)

    if (BigInt(userBalance) < BigInt(sellAmountBaseUnit)) {
      const availableAmount = fromBaseUnit(userBalance, sellAsset.precision)
      throw new Error(
        `Insufficient ${sellAsset.symbol} balance. Required: ${sellAmount}, Available: ${availableAmount}`
      )
    }

    logger?.info('✅ Balance check passed:', {
      sellAssetSymbol: sellAsset.symbol,
      required: sellAmount,
      available: fromBaseUnit(userBalance, sellAsset.precision),
    })

    if (needsApproval) {
      logger?.info('🔧 Building approval transaction:', {
        sellAssetId: sellAsset.assetId,
        sellAssetSymbol: sellAsset.symbol,
        approvalTarget: bestRate.approvalTarget,
      })
    }
    const approvalTx = buildApprovalTransaction(
      needsApproval,
      sellAsset,
      bestRate.approvalTarget,
      sellAmount,
      userAddress
    )

    const swapTx = buildSwapTransaction(bestRate)

    const summary = createSwapSummary(sellAsset, buyAsset, sellAmount, bestRate)

    const swapExecutionData = {
      sellAmountCryptoPrecision: sellAmount,
      buyAmountCryptoPrecision: bestRate.buyAmountCryptoPrecision,
      approvalTarget: bestRate.approvalTarget,
      sellAsset,
      buyAsset,
      sellAccount: userAddress,
      buyAccount: userAddress,
    }

    const result = {
      summary,
      needsApproval,
      approvalTx,
      swapTx,
      swapData: swapExecutionData,
    }

    logger?.info('✅ [prepareSwapTool] COMPLETED execution:', { needsApproval })

    return result
  },
})
