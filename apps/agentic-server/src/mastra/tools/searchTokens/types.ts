export type PortalsToken = {
  name: string
  decimals: number
  symbol: string
  price: number
  address: string
  platform: 'native' | 'basic'
  network: string
  image: string
}

export type PortalsResponse = {
  tokens: PortalsToken[]
  total: number
}

export type TokenSearchResult = {
  tokens: PortalsToken[]
  total: number
}
