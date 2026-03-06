import mixpanel from 'mixpanel-browser'

// Check if analytics is enabled
const isProduction = import.meta.env.PROD
const analyticsEnabled = isProduction || import.meta.env.VITE_ENABLE_ANALYTICS === 'true'

// Type-safe event tracking (no-ops when analytics is disabled)
export const analytics = {
  // Identify user when wallet connects
  identify: (userId: string, properties?: Record<string, unknown>) => {
    if (!analyticsEnabled) return
    mixpanel.identify(userId)
    if (properties) {
      mixpanel.people.set(properties)
    }
  },

  // Reset when wallet disconnects
  reset: () => {
    if (!analyticsEnabled) return
    mixpanel.reset()
  },

  // Track wallet connection
  trackWalletConnect: (props: { address: string; walletType: 'evm' | 'solana' }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Wallet Connect', props)
  },

  // Track swap execution
  trackSwap: (props: {
    sellAsset: string
    buyAsset: string
    sellAmount: string
    buyAmount: string
    network: string
  }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Swap', props)
  },

  // Track send transaction
  trackSend: (props: { asset: string; amount: string; network: string }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Send', props)
  },

  // Track limit order creation
  trackLimitOrder: (props: {
    sellAsset: string
    buyAsset: string
    sellAmount: string
    buyAmount: string
    network: string
    limitPrice: string
  }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Limit Order', props)
  },

  // Track limit order cancellation
  trackCancelLimitOrder: (props: { orderId: string; network: string }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Cancel Limit Order', props)
  },

  trackStopLoss: (props: {
    sellAsset: string
    buyAsset: string
    sellAmount: string
    triggerPrice: string
    network: string
  }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Stop Loss', props)
  },

  trackCancelStopLoss: (props: { orderId: string; network: string }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Cancel Stop Loss', props)
  },

  trackTwap: (props: {
    sellAsset: string
    buyAsset: string
    sellAmount: string
    network: string
    intervals: number
    frequency: string
  }) => {
    if (!analyticsEnabled) return
    mixpanel.track('TWAP', props)
  },

  trackCancelTwap: (props: { orderId: string; network: string }) => {
    if (!analyticsEnabled) return
    mixpanel.track('Cancel TWAP', props)
  },

  // Track chat message sent
  trackChatMessage: () => {
    if (!analyticsEnabled) return
    mixpanel.track('Chat Message Sent')
  },
}
