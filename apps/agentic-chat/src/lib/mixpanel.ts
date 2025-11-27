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

  // Track chat message sent
  trackChatMessage: () => {
    if (!analyticsEnabled) return
    mixpanel.track('Chat Message Sent')
  },
}
