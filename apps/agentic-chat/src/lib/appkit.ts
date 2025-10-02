import type { AppKitNetwork } from '@reown/appkit/networks'
import { gnosis, arbitrum, mainnet, polygon, optimism, base, avalanche, bsc, solana } from '@reown/appkit/networks'

export const evmNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  arbitrum,
  polygon,
  optimism,
  base,
  avalanche,
  bsc,
  gnosis,
]

export const allNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [...evmNetworks, solana]
