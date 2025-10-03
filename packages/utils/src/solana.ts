import type { ChainId } from '@shapeshiftoss/caip'
import { solanaChainId } from '@shapeshiftoss/caip'
import { Connection, type Commitment } from '@solana/web3.js'

const DEFAULT_COMMITMENT: Commitment = 'confirmed'

let solanaConnection: Connection | undefined

export const getSolanaRpcUrl = (): string => {
  const rpcUrl = process.env.SOLANA_RPC_URL
  if (!rpcUrl) {
    throw new Error('SOLANA_RPC_URL environment variable is not set')
  }
  return rpcUrl
}

export const getSolanaConnection = (chainId: ChainId): Connection => {
  if (chainId !== solanaChainId) {
    throw new Error(`Invalid Solana chainId: ${chainId}`)
  }

  if (!solanaConnection) {
    const rpcUrl = getSolanaRpcUrl()
    solanaConnection = new Connection(rpcUrl, DEFAULT_COMMITMENT)
  }

  return solanaConnection
}
