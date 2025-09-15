// Unified network identifiers for CoinGecko tools
// These are the enum values that the LLM will use consistently across both tools

export const UNIFIED_NETWORKS = [
  'ethereum',
  'optimism',
  'arbitrum',
  'polygon',
  'avalanche',
  'bsc',
  'base',
  'gnosis',
] as const

export type UnifiedNetwork = (typeof UNIFIED_NETWORKS)[number]

// Mapping from unified network IDs to CoinGecko search API platform IDs
export const UNIFIED_TO_SEARCH_PLATFORM: Record<UnifiedNetwork, string> = {
  ethereum: 'ethereum',
  optimism: 'optimistic-ethereum',
  arbitrum: 'arbitrum-one',
  polygon: 'polygon-pos',
  avalanche: 'avalanche',
  bsc: 'bsc',
  base: 'base',
  gnosis: 'xdai',
}

// Mapping from unified network IDs to CoinGecko onchain API network IDs
export const UNIFIED_TO_ONCHAIN_NETWORK: Record<UnifiedNetwork, string> = {
  ethereum: 'eth',
  optimism: 'optimism',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  avalanche: 'avax',
  bsc: 'bsc',
  base: 'base',
  gnosis: 'gnosis',
}

// Mapping from unified network IDs to our internal network keys for chainId lookup
export const UNIFIED_TO_NETWORK_KEY: Record<UnifiedNetwork, string> = {
  ethereum: 'ethereum',
  optimism: 'optimism',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  avalanche: 'avalanche',
  bsc: 'bsc',
  base: 'base',
  gnosis: 'gnosis',
}
