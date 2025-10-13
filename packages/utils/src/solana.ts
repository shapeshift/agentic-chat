import type { ChainId } from '@shapeshiftoss/caip'
import { solanaChainId } from '@shapeshiftoss/caip'
import { Connection } from '@solana/web3.js'
import type { Commitment } from '@solana/web3.js'

const DEFAULT_COMMITMENT: Commitment = 'confirmed'

let solanaConnection: Connection | undefined

export const getSolanaRpcUrl = (): string => {
  // Try VITE_ prefixed first (primary), fallback to non-prefixed (backwards compat)
  const rpcUrl = process.env.VITE_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL
  if (!rpcUrl) {
    throw new Error('VITE_SOLANA_RPC_URL environment variable is not set')
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
