import type { ChainId } from '@shapeshiftoss/caip'

import { sendTransactionForChain } from './chains/transactionRegistry'
import type { SolanaWalletProvider } from './chains/types'

type SendTransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  gasLimit?: number
  solanaProvider?: SolanaWalletProvider
}

export const sendTransaction = async (params: SendTransactionParams) => {
  return sendTransactionForChain(params)
}
