import { asset } from '@shapeshiftoss/types'
import z from 'zod'

// Base transaction schema that's reused across swap tools
export const transactionSchema = z.object({
  chainId: z.string(),
  data: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  gasLimit: z.string().optional(),
})

// Asset input schema for swap operations
export const assetInputSchema = z.object({
  symbolOrName: z.string().describe('Token symbol or name (e.g., "ETH", "USDC", "SOL")'),
  network: z
    .enum(['ethereum', 'optimism', 'arbitrum', 'polygon', 'avalanche', 'bsc', 'base', 'gnosis', 'solana'])
    .optional()
    .describe('Network for this asset. If not specified, will search across all networks.'),
})

// Comprehensive swap data schema
export const swapDataSchema = z.object({
  sellAmountCryptoPrecision: z.string(),
  buyAmountCryptoPrecision: z.string(),
  sellAmountUsd: z.string().optional(),
  buyAmountUsd: z.string().optional(),
  approvalTarget: z.string(),
  sellAsset: asset,
  buyAsset: asset,
  sellAccount: z.string(),
  buyAccount: z.string(),
})

// Summary schema for user-facing swap information
export const swapSummarySchema = z.object({
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
    networkFeeCrypto: z.string().optional(),
    networkFeeSymbol: z.string().optional(),
    networkFeeUsd: z.string().optional(),
  }),
  isCrossChain: z.boolean(),
})

// Core swap preparation output schema
export const swapPreparationSchema = z.object({
  summary: swapSummarySchema,
  needsApproval: z.boolean(),
  approvalTx: transactionSchema.optional(),
  swapTx: transactionSchema,
  swapData: swapDataSchema,
})

// Export type definitions
export type TransactionData = z.infer<typeof transactionSchema>
export type AssetInput = z.infer<typeof assetInputSchema>
export type SwapData = z.infer<typeof swapDataSchema>
export type SwapSummary = z.infer<typeof swapSummarySchema>
export type SwapPreparation = z.infer<typeof swapPreparationSchema>
