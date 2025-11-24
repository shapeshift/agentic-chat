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
    valueUSD: string
  }
  buyAsset: {
    symbol: string
    amount: string
    valueUSD: string
  }
  dex: string
  fee?: string
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
  fee?: string
  feeSymbol?: string
}

export type SwapActivityItem = BaseActivityItem & {
  type: 'swap'
  details: SwapActivityDetails
}

export type SendActivityItem = BaseActivityItem & {
  type: 'send'
  details: SendActivityDetails
}

export type ActivityItem = SwapActivityItem | SendActivityItem
