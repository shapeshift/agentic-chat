import type { ChainId } from '@shapeshiftoss/caip'

import { sendTransactionForChain } from './chains/transactionRegistry'

type SendTransactionParams = {
  chainId: ChainId
  data: string
  from: string
  to: string
  value: string
  gasLimit?: number
}

export const sendTransaction = async (params: SendTransactionParams) => {
  return sendTransactionForChain(params)
}
