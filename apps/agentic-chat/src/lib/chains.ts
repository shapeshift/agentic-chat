import type { EvmNetwork } from '@dynamic-labs/sdk-react-core'
import type { Chain } from 'viem'
import { mainnet, arbitrum, polygon, optimism, base, avalanche, bsc, gnosis } from 'viem/chains'

export interface ChainConfig {
  chain: Chain
  networkName: string
  caipId: string
  iconUrl: string
  blockExplorerUrl: string
  rpcUrl: string
  vanityName: string
}

export const SUPPORTED_EVM_CHAINS: ChainConfig[] = [
  {
    chain: mainnet,
    networkName: 'ethereum',
    caipId: 'eip155:1',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/eth.svg',
    blockExplorerUrl: 'https://etherscan.io/',
    rpcUrl: import.meta.env.VITE_ETHEREUM_NODE_URL,
    vanityName: 'Ethereum',
  },
  {
    chain: arbitrum,
    networkName: 'arbitrum',
    caipId: 'eip155:42161',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/arbitrum.svg',
    blockExplorerUrl: 'https://arbiscan.io/',
    rpcUrl: import.meta.env.VITE_ARBITRUM_NODE_URL,
    vanityName: 'Arbitrum',
  },
  {
    chain: polygon,
    networkName: 'polygon',
    caipId: 'eip155:137',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/polygon.svg',
    blockExplorerUrl: 'https://polygonscan.com/',
    rpcUrl: import.meta.env.VITE_POLYGON_NODE_URL,
    vanityName: 'Polygon',
  },
  {
    chain: optimism,
    networkName: 'optimism',
    caipId: 'eip155:10',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/optimism.svg',
    blockExplorerUrl: 'https://optimistic.etherscan.io/',
    rpcUrl: import.meta.env.VITE_OPTIMISM_NODE_URL,
    vanityName: 'Optimism',
  },
  {
    chain: base,
    networkName: 'base',
    caipId: 'eip155:8453',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/base.svg',
    blockExplorerUrl: 'https://basescan.org/',
    rpcUrl: import.meta.env.VITE_BASE_NODE_URL,
    vanityName: 'Base',
  },
  {
    chain: avalanche,
    networkName: 'avalanche',
    caipId: 'eip155:43114',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/avalanche.svg',
    blockExplorerUrl: 'https://snowtrace.io/',
    rpcUrl: import.meta.env.VITE_AVALANCHE_NODE_URL,
    vanityName: 'Avalanche',
  },
  {
    chain: bsc,
    networkName: 'bsc',
    caipId: 'eip155:56',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/bsc.svg',
    blockExplorerUrl: 'https://bscscan.com/',
    rpcUrl: import.meta.env.VITE_BNBSMARTCHAIN_NODE_URL,
    vanityName: 'BSC',
  },
  {
    chain: gnosis,
    networkName: 'gnosis',
    caipId: 'eip155:100',
    iconUrl: 'https://app.dynamic.xyz/assets/networks/gnosis.svg',
    blockExplorerUrl: 'https://gnosisscan.io/',
    rpcUrl: import.meta.env.VITE_GNOSIS_NODE_URL,
    vanityName: 'Gnosis',
  },
]

export const SOLANA_CAIP_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'

export type SupportedChainId = (typeof SUPPORTED_EVM_CHAINS)[number]['chain']['id']

export const SUPPORTED_CHAIN_IDS = SUPPORTED_EVM_CHAINS.map(c => c.chain.id) as [
  SupportedChainId,
  ...SupportedChainId[],
]

export const chainIdToChain: Record<number, Chain> = Object.fromEntries(
  SUPPORTED_EVM_CHAINS.map(c => [c.chain.id, c.chain])
)

export const networkNameToChainId: Record<string, number> = {
  ...Object.fromEntries(SUPPORTED_EVM_CHAINS.map(c => [c.networkName, c.chain.id])),
  solana: 0,
}

export const EVM_CAIP_IDS = SUPPORTED_EVM_CHAINS.map(c => c.caipId)

export const DYNAMIC_EVM_NETWORKS: EvmNetwork[] = SUPPORTED_EVM_CHAINS.map(config => ({
  blockExplorerUrls: [config.blockExplorerUrl],
  chainId: config.chain.id,
  chainName: config.chain.name,
  iconUrls: [config.iconUrl],
  name: config.vanityName,
  nativeCurrency: config.chain.nativeCurrency,
  networkId: config.chain.id,
  rpcUrls: [config.rpcUrl],
  vanityName: config.vanityName,
}))
