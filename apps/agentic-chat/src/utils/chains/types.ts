import type { ChainId } from '@shapeshiftoss/caip'
import type { Transaction, VersionedTransaction } from '@solana/web3.js'

export type ChainNamespace = 'eip155' | 'solana'

// Interface for Solana wallet signing capability
// Compatible with both Dynamic's signer and other wallet providers
export interface SolanaWalletSigner {
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>
}

// Legacy alias for backward compatibility
export type SolanaWalletProvider = SolanaWalletSigner

export type TransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  gasLimit?: number
  solanaSigner?: SolanaWalletSigner
}

export interface ChainTransactionAdapter {
  sendTransaction(params: TransactionParams): Promise<string>
}
