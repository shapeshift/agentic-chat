import type { SolanaWallet } from '@dynamic-labs/solana-core'

export interface LiveWallet {
  evmAddress?: string
  solanaAddress?: string
  solanaWallet?: SolanaWallet
}

// Synced from the app root so long-running executions read the current wallet,
// not refs that stop updating when their tool card unmounts.
let current: LiveWallet = {}

export function setLiveWallet(wallet: LiveWallet): void {
  current = wallet
}

export function getLiveWallet(): LiveWallet {
  return current
}
