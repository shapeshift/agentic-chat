// Global unified network identifiers used across all asset tools
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

// Network to ChainId mapping for portfolio operations
export const NETWORK_TO_CHAIN_ID: Record<UnifiedNetwork, string> = {
  ethereum: 'eip155:1',
  arbitrum: 'eip155:42161',
  optimism: 'eip155:10',
  base: 'eip155:8453',
  polygon: 'eip155:137',
  bsc: 'eip155:56',
  avalanche: 'eip155:43114',
  gnosis: 'eip155:100',
}
