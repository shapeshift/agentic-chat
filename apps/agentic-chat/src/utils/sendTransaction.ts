import type { ChainId } from '@shapeshiftoss/caip'

import { sendTransactionForChain } from './chains/transactionRegistry'
import type { SolanaWalletSigner } from './chains/types'

type SendTransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  gasLimit?: number
  solanaSigner?: SolanaWalletSigner
}

export const sendTransaction = async (params: SendTransactionParams) => {
  return sendTransactionForChain(params)
}
