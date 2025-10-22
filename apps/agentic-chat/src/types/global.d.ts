import type { Connection, Transaction, VersionedTransaction } from '@solana/web3.js'

declare global {
  interface Window {
    solana?: {
      signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>
      signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>
      sendTransaction<T extends Transaction | VersionedTransaction>(
        transaction: T,
        connection: Connection
      ): Promise<string>
    }
  }
}

export {}
