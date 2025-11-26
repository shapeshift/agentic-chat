import mixpanel from 'mixpanel-browser'

// Re-export the initialized mixpanel instance
export { mixpanel }

// Type-safe event tracking
export const analytics = {
  // Identify user when wallet connects
  identify: (userId: string, properties?: Record<string, unknown>) => {
    mixpanel.identify(userId)
    if (properties) {
      mixpanel.people.set(properties)
    }
  },

  // Reset when wallet disconnects
  reset: () => {
    mixpanel.reset()
  },

  // Track wallet connection
  trackWalletConnect: (props: { address: string; walletType: 'evm' | 'solana' }) => {
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
    mixpanel.track('Swap', props)
  },

  // Track send transaction
  trackSend: (props: { asset: string; amount: string; network: string }) => {
    mixpanel.track('Send', props)
  },

  // Track chat message sent
  trackChatMessage: () => {
    mixpanel.track('Chat Message Sent')
  },
}
