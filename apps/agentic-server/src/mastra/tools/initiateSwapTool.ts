import { createTool } from '@mastra/core'
import type { MastraUnion } from '@mastra/core/action'
import type { RuntimeContext } from '@mastra/core/runtime-context'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, GetRateOutput } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import { toBaseUnit, fromBaseUnit } from '@shapeshiftoss/utils'
import { PublicKey } from '@solana/web3.js'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import z from 'zod'

import { getAllowance } from '../../utils'
import { isEvmChain, isSolanaChain } from '../../utils/chains/helpers'
import { getBebopRate } from '../../utils/getBebopRate'
import { getRelayRate } from '../../utils/getRelayRate'
import { getAddressForChain } from '../../utils/walletContext'

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
  const sellValueUSD = (parseFloat(sellAmount) * parseFloat(sellAsset.price || '0')).toFixed(2)
  const buyEstimatedValueUSD = (
    parseFloat(bestRate.buyAmountCryptoPrecision) * parseFloat(buyAsset.price || '0')
  ).toFixed(2)
  const exchangeRate = (parseFloat(bestRate.buyAmountCryptoPrecision) / parseFloat(sellAmount)).toFixed(8)

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

async function executeSwapInternal({
  sellAssetInput,
  buyAssetInput,
  sellAmountCrypto,
  mastra,
  runtimeContext,
}: {
  sellAssetInput: AssetInput
  buyAssetInput: AssetInput
  sellAmountCrypto: string
  mastra: MastraUnion
  runtimeContext: RuntimeContext<unknown>
}) {
  const logger = mastra?.getLogger()
  logger?.info('executeSwapInternal', { sellAssetInput, buyAssetInput, sellAmountCrypto })

  if (!Number.isFinite(parseFloat(sellAmountCrypto)) || parseFloat(sellAmountCrypto) <= 0) {
    throw new Error('Sell amount must be a positive number')
  }

  const { sellAsset, buyAsset } = await resolveSwapAssets(
    sellAssetInput,
    buyAssetInput,
    getAssetsTool,
    mastra,
    runtimeContext
  )

  const sellAddress = getAddressForChain(runtimeContext, sellAsset.chainId)
  const buyAddress = getAddressForChain(runtimeContext, buyAsset.chainId)

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

  const accountData = await getAccountTool.execute({
    context: { account: sellAddress, network: chainIdToNetwork[sellAsset.chainId] },
    mastra,
    runtimeContext,
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

export const initiateSwapInput = z.object({
  sellAsset: assetInputSchema.describe('Asset to sell'),
  buyAsset: assetInputSchema.describe('Asset to buy'),
  sellAmount: z.string().describe('Amount to sell in crypto tokens, e.g. 1 for 1 ETH, 0.5 for 0.5 SOL'),
})

export const initiateSwapOutput = swapPreparationSchema

export type InitiateSwapInput = z.infer<typeof initiateSwapInput>
export type InitiateSwapOutput = z.infer<typeof initiateSwapOutput>

export const initiateSwapTool = createTool({
  id: 'initiateSwap',
  description:
    'Start a crypto swap using CRYPTO TOKEN amounts. ONLY supports EVM chains (Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BSC, Gnosis) and Solana. NOT supported for Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, Cardano, or Sui. Use initiateSwapUsd for USD-denominated amounts.',
  inputSchema: initiateSwapInput,
  outputSchema: initiateSwapOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    if (!mastra) {
      throw Error('no mastra instance')
    }

    return executeSwapInternal({
      sellAssetInput: context.sellAsset,
      buyAssetInput: context.buyAsset,
      sellAmountCrypto: context.sellAmount,
      mastra,
      runtimeContext,
    })
  },
})

export const initiateSwapUsdInput = z.object({
  sellAsset: assetInputSchema.describe('Asset to sell'),
  buyAsset: assetInputSchema.describe('Asset to buy'),
  sellAmountUsd: z.string().describe('USD value to swap, e.g. "100" for $100 worth, "1.50" for $1.50 worth'),
})

export const initiateSwapUsdOutput = swapPreparationSchema

export type InitiateSwapUsdInput = z.infer<typeof initiateSwapUsdInput>
export type InitiateSwapUsdOutput = z.infer<typeof initiateSwapUsdOutput>

export const initiateSwapUsdTool = createTool({
  id: 'initiateSwapUsd',
  description:
    'Start a crypto swap using USD VALUE amounts (e.g., $100 worth of ETH). Fetches current price and converts to token amount. ONLY supports EVM chains (Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BSC, Gnosis) and Solana. NOT supported for Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, Cardano, or Sui.',
  inputSchema: initiateSwapUsdInput,
  outputSchema: initiateSwapUsdOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger()
    if (!mastra) {
      throw Error('no mastra instance')
    }
    logger?.info('initiateSwapUsdTool', { context })

    const { sellAsset: sellAssetInput, buyAsset: buyAssetInput, sellAmountUsd } = context

    if (!Number.isFinite(parseFloat(sellAmountUsd)) || parseFloat(sellAmountUsd) <= 0) {
      throw new Error('USD amount must be a positive number')
    }

    const sellAssetsResult = await getAssetsTool.execute({
      context: { searchTerm: sellAssetInput.symbolOrName, network: sellAssetInput.network },
      mastra,
      runtimeContext,
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

    logger?.info('USD to crypto conversion', {
      sellAmountUsd,
      sellAssetPrice,
      sellAmountCrypto,
      asset: sellAsset.symbol,
    })

    return executeSwapInternal({
      sellAssetInput,
      buyAssetInput,
      sellAmountCrypto,
      mastra,
      runtimeContext,
    })
  },
})
