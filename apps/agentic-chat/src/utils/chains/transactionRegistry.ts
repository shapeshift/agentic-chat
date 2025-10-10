import { fromChainId } from '@shapeshiftoss/caip'

import { sendEvmTransaction } from './evm/transaction'
import { sendSolanaTransaction } from './solana/transaction'
import type { ChainNamespace, ChainTransactionAdapter, TransactionParams } from './types'

/**
 * Transaction adapters for sending transactions on different chains.
 * These adapters handle the chain-specific transaction signing and broadcasting.
 */

const transactionAdapters: Record<ChainNamespace, ChainTransactionAdapter> = {
  eip155: {
    sendTransaction: sendEvmTransaction,
  },
  solana: {
    sendTransaction: sendSolanaTransaction,
  },
}

export async function sendTransactionForChain(params: TransactionParams): Promise<string> {
  const { chainNamespace } = fromChainId(params.chainId)

  const adapter = transactionAdapters[chainNamespace as ChainNamespace]

  if (!adapter) {
    throw new Error(`Unsupported chain namespace: ${chainNamespace}`)
  }

  return adapter.sendTransaction(params)
}
