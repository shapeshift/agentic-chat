const EXPLORER_BASE: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  polygon: 'https://polygonscan.com',
  arbitrum: 'https://arbiscan.io',
  base: 'https://basescan.org',
  avalanche: 'https://snowtrace.io',
  optimism: 'https://optimistic.etherscan.io',
  bsc: 'https://bscscan.com',
  gnosis: 'https://gnosisscan.io',
  solana: 'https://solscan.io',
}

export function getExplorerUrl(network: string, txid: string): string {
  const base = EXPLORER_BASE[network] ?? EXPLORER_BASE.ethereum
  return `${base}/tx/${txid}`
}

export function getExplorerAddressUrl(network: string, address: string): string {
  const base = EXPLORER_BASE[network] ?? EXPLORER_BASE.ethereum
  return `${base}/address/${address}`
}

const SAFE_APP_PREFIX: Record<string, string> = {
  ethereum: 'eth',
  arbitrum: 'arb1',
  gnosis: 'gno',
  polygon: 'matic',
  base: 'base',
  optimism: 'oeth',
  avalanche: 'avax',
}

export function getSafeAppUrl(network: string, safeAddress: string): string {
  const prefix = SAFE_APP_PREFIX[network] ?? 'eth'
  return `https://app.safe.global/home?safe=${prefix}:${safeAddress}`
}
