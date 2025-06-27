export type PortalsToken = {
  network: string
  address: string
  symbol: string
  name: string
  decimals: number
  chainId: number
  image: string
  volumeUsd7d: number
  priceUsd: number
}

export type PortalsResponse = {
  tokens: PortalsToken[]
  total: number
}

export type TokenSearchResult = {
  tokens: PortalsToken[]
  total: number
}
