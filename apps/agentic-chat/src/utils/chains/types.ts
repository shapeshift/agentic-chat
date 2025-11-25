import type { ChainId } from '@shapeshiftoss/caip'
import type { Transaction, VersionedTransaction } from '@solana/web3.js'

export type ChainNamespace = 'eip155' | 'solana'

export interface SolanaWalletProvider {
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>
}

export type TransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  gasLimit?: number
  nonce?: number
  solanaProvider?: SolanaWalletProvider
}

export interface ChainTransactionAdapter {
  sendTransaction(params: TransactionParams): Promise<string>
}
