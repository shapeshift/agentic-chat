import { NETWORKS } from '@shapeshiftoss/types'
import z from 'zod'

export const evmTokenTransferSchema = z.object({
  contract: z.string(),
  decimals: z.number(),
  name: z.string(),
  symbol: z.string(),
  type: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
})

export const solanaTokenTransferSchema = z.object({
  fromUserAccount: z.string().optional(),
  toUserAccount: z.string().optional(),
  fromTokenAccount: z.string().optional(),
  toTokenAccount: z.string().optional(),
  amount: z.number().optional(),
  mint: z.string().optional(),
  token: z
    .object({
      symbol: z.string(),
      name: z.string(),
      decimals: z.number(),
    })
    .optional(),
})

export const solanaNativeTransferSchema = z.object({
  fromUserAccount: z.string(),
  toUserAccount: z.string(),
  amount: z.number(),
})

export const evmTxSchema = z.object({
  txid: z.string(),
  blockHash: z.string().optional(),
  blockHeight: z.number(),
  timestamp: z.number(),
  status: z.number(),
  from: z.string(),
  to: z.string(),
  confirmations: z.number(),
  value: z.string(),
  fee: z.string(),
  gasLimit: z.string().optional(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
  inputData: z.string().optional(),
  tokenTransfers: z.array(evmTokenTransferSchema).optional(),
})

export const solanaTxSchema = z.object({
  txid: z.string(),
  blockHeight: z.number(),
  timestamp: z.number(),
  fee: z.number(),
  feePayer: z.string(),
  transactionError: z.any().nullable(),
  tokenTransfers: z.array(solanaTokenTransferSchema).optional(),
  nativeTransfers: z.array(solanaNativeTransferSchema).optional(),
  description: z.string().optional(),
  type: z.string().optional(),
})

export const getTransactionHistoryInput = z.object({
  network: z.enum(NETWORKS).describe('Network name (e.g., ethereum, arbitrum, solana)'),
  pageSize: z.number().min(1).max(50).optional().default(10).describe('Number of transactions to fetch (max 50)'),
  cursor: z.string().optional().describe('Pagination cursor for fetching next page'),
})

export const parsedTransactionSchema = z.object({
  txid: z.string(),
  timestamp: z.number(),
  blockHeight: z.number(),
  status: z.enum(['success', 'failed']),
  type: z.enum(['send', 'receive', 'contract', 'swap']),
  value: z.string(),
  fee: z.string(),
  from: z.string(),
  to: z.string(),
  tokenTransfers: z
    .array(
      z.object({
        symbol: z.string(),
        amount: z.string(),
        decimals: z.number(),
        from: z.string(),
        to: z.string(),
        contract: z.string().optional(),
      })
    )
    .optional(),
})

export const getTransactionHistoryOutput = z.object({
  address: z.string(),
  chainId: z.string(),
  transactions: z.array(parsedTransactionSchema),
  cursor: z.string().optional(),
})

export type EvmTx = z.infer<typeof evmTxSchema>
export type SolanaTx = z.infer<typeof solanaTxSchema>
export type GetTransactionHistoryInput = z.infer<typeof getTransactionHistoryInput>
export type GetTransactionHistoryOutput = z.infer<typeof getTransactionHistoryOutput>
