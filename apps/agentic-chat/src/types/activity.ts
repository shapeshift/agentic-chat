interface BaseActivityItem {
  id: string
  timestamp: number
  txHash: string
  chainId: string
  network: string
}

export interface SwapActivityDetails {
  sellAsset: {
    symbol: string
    amount: string
    valueUSD: string | null
  }
  buyAsset: {
    symbol: string
    amount: string
    valueUSD: string | null
  }
  dex: string
  fee?: string | null
  approval?: {
    txHash: string
    spender: string
  }
}

export interface SendActivityDetails {
  asset: {
    symbol: string
    amount: string
  }
  from: string
  to: string
  fee?: string | null
  feeSymbol?: string
}

export interface LimitOrderActivityDetails {
  sellAsset: {
    symbol: string
    amount: string
  }
  buyAsset: {
    symbol: string
    estimatedAmount: string
  }
  limitPrice: string
  expiresAt: string
  provider: string
  trackingUrl: string
}

export type SwapActivityItem = BaseActivityItem & {
  type: 'swap'
  details: SwapActivityDetails
}

export type SendActivityItem = BaseActivityItem & {
  type: 'send'
  details: SendActivityDetails
}

export type LimitOrderActivityItem = Omit<BaseActivityItem, 'txHash'> & {
  type: 'limit_order'
  orderId: string
  details: LimitOrderActivityDetails
}

export type ActivityItem = SwapActivityItem | SendActivityItem | LimitOrderActivityItem
