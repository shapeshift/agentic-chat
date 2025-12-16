// CoW Protocol API URLs by chain ID
export const COW_API_URLS: Record<number, string> = {
  1: 'https://api.cow.fi/mainnet',
  100: 'https://api.cow.fi/gnosis',
  42161: 'https://api.cow.fi/arbitrum_one',
}

export function getCowApiUrl(chainId: number): string {
  const apiUrl = COW_API_URLS[chainId]
  if (!apiUrl) {
    throw new Error(`Unsupported chain for CoW Protocol: ${chainId}`)
  }
  return apiUrl
}
