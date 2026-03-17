import { isEthereumWallet } from '@dynamic-labs/ethereum'
import type { EthereumWallet } from '@dynamic-labs/ethereum-core'
import { useUserWallets } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import { useQuery } from '@tanstack/react-query'

import { EVM_CAIP_IDS, SOLANA_CAIP_ID } from '@/lib/chains'

// WalletConnect only exposes a single BIP-44 account (Account #0), so users
// with assets in additional accounts will see incomplete portfolio balances.
// Fixing this requires supporting native/injected wallet connections that
// allow BIP-44 derivation path iteration (as the main ShapeShift app does).
interface WalletConnectConnector {
  isWalletConnect?: boolean
  getSupportedNetworks?: () => Promise<string[]>
}

async function getApprovedChainsForEvmWallet(wallet: EthereumWallet): Promise<string[]> {
  const connector = wallet.connector as WalletConnectConnector

  if (connector.isWalletConnect && connector.getSupportedNetworks) {
    try {
      const networks = await connector.getSupportedNetworks()
      return networks.map(chainId => `eip155:${chainId}`)
    } catch (error) {
      console.error('Failed to get supported networks from WalletConnect:', error)
      return EVM_CAIP_IDS
    }
  }

  // For injected wallets (MetaMask, etc.), they typically support all chains
  return EVM_CAIP_IDS
}

export function useApprovedChains(): string[] {
  const userWallets = useUserWallets()

  const { data } = useQuery({
    queryKey: ['approvedChains', userWallets.map(w => w.id).join(',')],
    queryFn: async () => {
      const chainIds = new Set<string>()

      for (const wallet of userWallets) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- SDK type variance
        if (isSolanaWallet(wallet)) {
          chainIds.add(SOLANA_CAIP_ID)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- SDK type variance
        } else if (isEthereumWallet(wallet)) {
          const evmChains = await getApprovedChainsForEvmWallet(wallet)
          evmChains.forEach(c => chainIds.add(c))
        }
      }

      return Array.from(chainIds)
    },
    enabled: userWallets.length > 0,
    staleTime: 30_000,
  })

  return data ?? []
}
