interface TokenBalance {
  contract: string
  decimals: number
  name: string
  symbol: string
  type: string
  id?: string
  balance: string
}

export interface Account {
  balance: string
  unconfirmedBalance: string
  pubkey: string
  nonce: number
  tokens: Array<TokenBalance>
}
