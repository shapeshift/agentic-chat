import type { AssetId, ChainId } from '@shapeshiftoss/caip'

export type PortfolioAsset = {
  assetId: AssetId
  chainId: ChainId
  name: string
  symbol: string
  icon?: string
  cryptoBalancePrecision: string
  fiatAmount: string
  price: string
  priceChange24h: string
  allocation: number
  relatedAssetKey?: string
  isPrimary?: boolean
  isChainSpecific?: boolean
}

export type GroupedPortfolioAsset = {
  primaryAsset: PortfolioAsset
  relatedAssets: PortfolioAsset[]
  totalFiatAmount: string
  totalCryptoBalancePrecision: string
  aggregatedAllocation: number
}

export type PortfolioDelta = {
  fiatAmount: string
  percentage: number
}

export type PortfolioData = {
  assets: PortfolioAsset[]
  totalBalance: string
  delta24h: PortfolioDelta | null
  lastUpdated: number
}
