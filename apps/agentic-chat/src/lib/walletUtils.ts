// Dynamic SDK type variance: useUserWallets returns Wallet<any>[] but type guards expect
// specific Wallet types. We derive the input type from useUserWallets to match exactly.
import { isEthereumWallet } from '@dynamic-labs/ethereum'
import type { EthereumWallet } from '@dynamic-labs/ethereum-core'
import type { useUserWallets } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { SolanaWallet } from '@dynamic-labs/solana-core'

type UserWallet = ReturnType<typeof useUserWallets>[number]

export function findEvmWallet(wallets: UserWallet[]): EthereumWallet | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return wallets.find((w): w is EthereumWallet => isEthereumWallet(w))
}

export function findSolanaWallet(wallets: UserWallet[]): SolanaWallet | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return wallets.find((w): w is SolanaWallet => isSolanaWallet(w))
}

export function filterEvmWallets(wallets: UserWallet[]): EthereumWallet[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return wallets.filter((w): w is EthereumWallet => isEthereumWallet(w))
}

export function filterSolanaWallets(wallets: UserWallet[]): SolanaWallet[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return wallets.filter((w): w is SolanaWallet => isSolanaWallet(w))
}
