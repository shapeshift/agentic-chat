import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import { unsignedTx } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import z from 'zod'

import { getAllowance } from '../../utils'
import { getBebopRate } from '../../utils/getBebopRate'
import { getRelayRate } from '../../utils/getRelayRate'

import { getAssetsTool } from './asset/getAssetsTool'

const assetInput = z.object({
  symbolOrName: z.string().describe('Token symbol or name (e.g., "ETH", "USDC", "Bitcoin")'),
  network: z
    .enum(['ethereum', 'optimism', 'arbitrum', 'polygon', 'avalanche', 'bsc', 'base', 'gnosis'])
    .optional()
    .describe('Network for this asset. If not specified, will search across all networks.'),
})

export const prepareSwapInput = z.object({
  sellAsset: assetInput.describe('Asset to sell'),
  buyAsset: assetInput.describe('Asset to buy'),
  sellAmount: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
  userAddress: z.string().describe('User wallet address for the swap'),
})

export const prepareSwapOutput = z.object({
  summary: z.object({
    sellAsset: z.object({
      symbol: z.string(),
      amount: z.string(),
      network: z.string(),
      chainName: z.string(),
      valueUSD: z.string(),
      priceUSD: z.string(),
    }),
    buyAsset: z.object({
      symbol: z.string(),
      estimatedAmount: z.string(),
      network: z.string(),
      chainName: z.string(),
      estimatedValueUSD: z.string(),
      priceUSD: z.string(),
    }),
    exchange: z.object({
      provider: z.string(),
      rate: z.string(),
      priceImpact: z.string().optional(),
    }),
    isCrossChain: z.boolean(),
  }),
  needsApproval: z.boolean(),
  approvalTx: unsignedTx.optional(),
  swapTx: unsignedTx,
  swapData: z.object({
    sellAmountCryptoPrecision: z.string(),
    buyAmountCryptoPrecision: z.string(),
    approvalTarget: z.string(),
    sellAsset: z.any(),
    buyAsset: z.any(),
    sellAccount: z.string(),
    buyAccount: z.string(),
  }),
})

export type PrepareSwapInput = z.infer<typeof prepareSwapInput>
export type PrepareSwapOutput = z.infer<typeof prepareSwapOutput>

export const prepareSwapTool = createTool({
  id: 'prepareSwap',
  description: 'Prepare a swap by fetching rates, checking allowances, and building unsigned transactions',
  inputSchema: prepareSwapInput,
  outputSchema: prepareSwapOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger()
    logger?.info('prepareSwapTool:', { context })

    const { sellAsset: sellAssetInput, buyAsset: buyAssetInput, sellAmount, userAddress } = context

    // Search for assets
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

    // Debug logging for resolved assets
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

    // Fetch rates from both providers
    const [bebopRate, relayRate] = await Promise.all([
      getBebopRate({
        address: userAddress,
        sellAsset,
        buyAsset,
        sellAmountCryptoPrecision: sellAmount,
      }).catch(() => null),
      getRelayRate({
        address: userAddress,
        sellAsset,
        buyAsset,
        sellAmountCryptoPrecision: sellAmount,
      }).catch(() => null),
    ])

    // Choose best rate
    const bestRate = [bebopRate, relayRate].filter(Boolean).reduce((best, current) => {
      if (!best) return current
      return parseFloat(current!.buyAmountCryptoPrecision) > parseFloat(best.buyAmountCryptoPrecision) ? current : best
    })

    if (!bestRate) {
      throw new Error('No rates available from any provider')
    }

    // Check allowance
    const allowanceData = await getAllowance({
      amount: toBaseUnit(sellAmount, sellAsset.precision),
      asset: sellAsset,
      from: userAddress,
      spender: bestRate.approvalTarget,
    })

    const needsApproval = allowanceData.isApprovalRequired

    // Debug logging for approval check
    logger?.info('🔍 Allowance check:', {
      needsApproval,
      sellAssetId: sellAsset.assetId,
      sellAssetSymbol: sellAsset.symbol,
      approvalTarget: bestRate.approvalTarget,
      sellAmount,
      sellAmountBaseUnit: toBaseUnit(sellAmount, sellAsset.precision),
    })

    // Check allowance and build approval transaction if needed
    let approvalTx: z.infer<typeof unsignedTx> | undefined
    if (needsApproval) {
      logger?.info('🔧 Building approval transaction:', {
        sellAssetId: sellAsset.assetId,
        sellAssetSymbol: sellAsset.symbol,
        approvalTarget: bestRate.approvalTarget,
      })

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [getAddress(bestRate.approvalTarget), BigInt(toBaseUnit(sellAmount, sellAsset.precision))],
      })

      const tokenAddress = fromAssetId(sellAsset.assetId).assetReference

      approvalTx = {
        chainId: sellAsset.chainId,
        data,
        from: userAddress,
        to: tokenAddress,
        value: '0',
      }
    }

    // Build swap transaction with data validation
    const swapTx: z.infer<typeof unsignedTx> = bestRate.unsignedTx
    
    // Validate transaction data for JSON serialization
    if (swapTx.data && typeof swapTx.data === 'string') {
      // Ensure the data is a valid hex string
      if (!swapTx.data.startsWith('0x')) {
        throw new Error('Invalid transaction data: must start with 0x')
      }
      // Log the data length for debugging
      logger?.info('💾 Swap transaction data size:', {
        dataLength: swapTx.data.length,
        provider: bestRate.source,
      })
    }

    // Create enhanced summary for user
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

    const summary = {
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

    const swapData = {
      sellAmountCryptoPrecision: sellAmount,
      buyAmountCryptoPrecision: bestRate.buyAmountCryptoPrecision,
      approvalTarget: bestRate.approvalTarget,
      sellAsset,
      buyAsset,
      sellAccount: userAddress,
      buyAccount: userAddress,
    }

    return {
      summary,
      needsApproval,
      approvalTx,
      swapTx,
      swapData,
    }
  },
})
