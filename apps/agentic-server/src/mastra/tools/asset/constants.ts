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
