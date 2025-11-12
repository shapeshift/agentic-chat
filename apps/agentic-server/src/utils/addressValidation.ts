import { PublicKey } from '@solana/web3.js'
import { getAddress, isAddress } from 'viem'

import { isEvmChain, isSolanaChain } from './chains/helpers'

export function validateAddress(address: string, chainId: string): void {
  if (isEvmChain(chainId)) {
    validateEvmAddress(address)
  } else if (isSolanaChain(chainId)) {
    validateSolanaAddress(address)
  } else {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
}

export function validateEvmAddress(address: string): void {
  if (!isAddress(address)) {
    throw new Error(`Invalid EVM address: ${address}`)
  }
  getAddress(address)
}

export function validateSolanaAddress(address: string): void {
  try {
    new PublicKey(address)
  } catch {
    throw new Error(`Invalid Solana address: ${address}`)
  }
}
