import type { ChainId } from '@shapeshiftoss/caip'

export type ChainNamespace = 'eip155' | 'solana'

export type TransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  gasLimit?: number
}

export interface ChainTransactionAdapter {
  sendTransaction(params: TransactionParams): Promise<string>
}
