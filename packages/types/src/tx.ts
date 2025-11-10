import z from 'zod'

export type UnsignedTx = z.infer<typeof unsignedTx>

export const unsignedTx = z.object({
  from: z.string(),
  chainId: z.string(),
  to: z.string(),
  value: z.string(),
  data: z.string(),
  gasLimit: z.number().optional(),
})

export type TokenTransfer = {
  symbol: string
  amount: string
  decimals: number
  from: string
  to: string
  contract?: string
  assetId: string
}

type BaseTransaction = {
  txid: string
  timestamp: number
  blockHeight: number
  status: 'success' | 'failed'
  fee: string
  from: string
  to: string
}

export type SendTransaction = BaseTransaction & {
  type: 'send'
  value: string
  tokenTransfers?: TokenTransfer[]
}

export type ReceiveTransaction = BaseTransaction & {
  type: 'receive'
  value: string
  tokenTransfers?: TokenTransfer[]
}

export type SwapTransaction = BaseTransaction & {
  type: 'swap'
  value: string
  tokenTransfers: TokenTransfer[]
}

export type ContractTransaction = BaseTransaction & {
  type: 'contract'
  value: string
  tokenTransfers?: TokenTransfer[]
}

export type ParsedTransaction = SendTransaction | ReceiveTransaction | SwapTransaction | ContractTransaction

export function isSendTransaction(tx: ParsedTransaction): tx is SendTransaction {
  return tx.type === 'send'
}

export function isReceiveTransaction(tx: ParsedTransaction): tx is ReceiveTransaction {
  return tx.type === 'receive'
}

export function isSwapTransaction(tx: ParsedTransaction): tx is SwapTransaction {
  return tx.type === 'swap'
}

export function isContractTransaction(tx: ParsedTransaction): tx is ContractTransaction {
  return tx.type === 'contract'
}
