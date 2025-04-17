export type Wallet = {
  name: string
  address: string
  balance: number
  logo: React.ElementType
}

export type WalletList = {
  wallets: Wallet[]
}