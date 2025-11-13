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

export const transactionFilterParams = {
  types: z
    .array(z.enum(['send', 'receive', 'swap', 'contract']))
    .optional()
    .describe('Filter by transaction types (e.g., ["swap", "send"])'),
  status: z
    .array(z.enum(['success', 'failed']))
    .optional()
    .describe('Filter by transaction status'),
  dateFrom: z.number().optional().describe('Filter transactions from this Unix timestamp (inclusive)'),
  dateTo: z.number().optional().describe('Filter transactions until this Unix timestamp (inclusive)'),
}

export const getTransactionHistoryInput = z.object({
  address: z
    .string()
    .optional()
    .describe(
      'Wallet address to query. If not provided, uses connected wallet address. For EVM networks, provide checksummed address (0x...). For Solana, provide base58 address.'
    ),
  network: z
    .enum(NETWORKS)
    .optional()
    .describe(
      'Network name (e.g., ethereum, arbitrum, solana). If not provided, fetches from all supported networks (EVM + Solana)'
    ),
  pageSize: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Number of transactions to fetch per network (max 50)'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Maximum total transactions to return across all networks after sorting by timestamp. Use this to limit results (e.g., limit=1 for most recent transaction only)'
    ),
  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe(
      'Number of transactions to skip before applying limit. Use for targeting specific transactions (e.g., offset=1 for second most recent, offset=2 for third most recent)'
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for fetching next page (only works when network is specified)'),
  ...transactionFilterParams,
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
        assetId: z.string(),
      })
    )
    .optional(),
})

export const getTransactionHistoryOutput = z.object({
  transactions: z.array(parsedTransactionSchema),
  cursors: z.record(z.string(), z.string()).optional(),
  networksChecked: z.array(z.string()),
  errors: z.record(z.string(), z.string()).optional(),
})

export type EvmTx = z.infer<typeof evmTxSchema>
export type SolanaTx = z.infer<typeof solanaTxSchema>
export type GetTransactionHistoryInput = z.infer<typeof getTransactionHistoryInput>
export type GetTransactionHistoryOutput = z.infer<typeof getTransactionHistoryOutput>
