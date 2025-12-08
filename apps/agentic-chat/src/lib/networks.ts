import type { AppKitNetwork } from '@reown/appkit/networks'
import { arbitrum, avalanche, base, bsc, gnosis, mainnet, optimism, polygon, solana } from '@reown/appkit/networks'

// Map chainId (number) to AppKit network for swap/send execution
export const chainIdToNetwork: Record<number, AppKitNetwork> = {
  1: mainnet,
  42161: arbitrum,
  137: polygon,
  10: optimism,
  8453: base,
  43114: avalanche,
  56: bsc,
  100: gnosis,
}

// Map network name (string) to AppKit network for switchNetwork tool
export const networkNameToNetwork: Record<string, AppKitNetwork> = {
  ethereum: mainnet,
  arbitrum,
  polygon,
  optimism,
  base,
  avalanche,
  bsc,
  gnosis,
  solana,
}
